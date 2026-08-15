import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Coffee,
  Play,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Crosshair,
  Loader2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import {
  apiClockIn,
  apiClockOut,
  apiStartBreak,
  apiEndBreak,
  apiGetTimeTracking,
  apiGeofenceCheck,
} from '../../api/clockInApi.js';
import { apiUpdateLocationFull } from '../../api/workforceService.js';
import { getGPSPosition } from '../../hooks/useGPSPosition.js';

export function ClockInCard({ onStatusChange }) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeBreak, setActiveBreak] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [geoStatus, setGeoStatus] = useState({ allowed: null, distance_m: null, message: 'Geofence Check Pending' });
  const [loading, setLoading] = useState(false);
  const [locScanning, setLocScanning] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [clockInTime, setClockInTime] = useState(null);
  const [completedBreakSeconds, setCompletedBreakSeconds] = useState(0);
  const [showBreakModal, setShowBreakModal] = useState(false);

  // Fetch current authoritative server state
  const loadServerState = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await apiGetTimeTracking();
      if (data) {
        setIsClockedIn(Boolean(data.is_clocked_in));
        const activeBrk = data.active_break ? data.active_break.break_type : null;
        setActiveBreak(activeBrk);

        if (data.is_clocked_in && data.clock_in_time) {
          setClockInTime(data.clock_in_time);
          const startMs = new Date(data.clock_in_time).getTime();
          const nowMs = Date.now();
          const breakSecs = data.time_log ? (data.time_log.break_seconds || 0) : 0;
          setCompletedBreakSeconds(breakSecs);
          const totalSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000) - breakSecs);
          setElapsedSeconds(totalSecs);
        } else {
          setClockInTime(null);
          setCompletedBreakSeconds(0);
          setElapsedSeconds(0);
        }
      }
    } catch (err) {
      if (err.status !== 401) {
        setErrorMsg(err.message || 'Failed to sync shift status from server.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServerState();
  }, [loadServerState]);

  // Live timer interval calculation based on server timestamp and break deductions
  useEffect(() => {
    let timer;
    if (isClockedIn && !activeBreak && clockInTime) {
      timer = setInterval(() => {
        const startMs = new Date(clockInTime).getTime();
        const nowMs = Date.now();
        const rawSecs = Math.floor((nowMs - startMs) / 1000);
        setElapsedSeconds(Math.max(0, rawSecs - completedBreakSeconds));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isClockedIn, activeBreak, clockInTime, completedBreakSeconds]);

  const formatTimer = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Perform browser GPS geofence check
  const handleCheckGeofence = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const pos = await getGPSPosition(true);
      const res = await apiGeofenceCheck(pos.coords.latitude, pos.coords.longitude);
      setGeoStatus({
        allowed: res.allowed,
        distance_m: res.distance_m,
        message: res.allowed
          ? `Authorized Location: ${res.matched_location || 'Site In-Bounds'} (${res.distance_m ?? 0}m)`
          : `Outside Geofence Bounds: ${res.reason || 'Distance Exceeds Limit'}`,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Geofence check failed.');
    } finally {
      setLoading(false);
    }
  };

  // Perform Clock-In using real browser GPS
  const handleClockIn = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const pos = await getGPSPosition(true);
      const res = await apiClockIn({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp || Date.now(),
        address: 'GPS Verified Location',
      });

      setIsClockedIn(true);
      setSuccessMsg(res.message || 'Clocked in successfully!');
      await loadServerState();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      setErrorMsg(err.message || 'Clock-in rejected.');
    } finally {
      setLoading(false);
    }
  };

  // Perform Clock-Out
  const handleClockOut = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let lat = null;
      let lon = null;

      try {
        const pos = await getGPSPosition(false);
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {
        // Clock-out doesn't strictly block on GPS failure
      }

      const res = await apiClockOut({ lat, lon });
      setIsClockedIn(false);
      setActiveBreak(null);
      setSuccessMsg(res.message || 'Clocked out of shift successfully.');
      await loadServerState();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      setErrorMsg(err.message || 'Clock-out failed.');
    } finally {
      setLoading(false);
    }
  };

  // Perform Break Start / End
  const handleBreakAction = async (type) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowBreakModal(false);

    try {
      if (!activeBreak) {
        const res = await apiStartBreak(type);
        setActiveBreak(type);
        setSuccessMsg(res.message || `${type.toUpperCase()} break started.`);
      } else {
        const res = await apiEndBreak();
        setActiveBreak(null);
        setSuccessMsg(res.message || 'Break ended. Work shift resumed.');
      }
      await loadServerState();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      setErrorMsg(err.message || 'Break action failed.');
    } finally {
      setLoading(false);
    }
  };

  // Listen to external location updates (e.g. from TopHeader or background tracker)
  useEffect(() => {
    const handleLocEvent = (e) => {
      if (e.detail?.latitude && e.detail?.longitude) {
        setLiveLocation({
          latitude: e.detail.latitude,
          longitude: e.detail.longitude,
          accuracy: e.detail.accuracy,
          updated_at: e.detail.timestamp ? new Date(e.detail.timestamp) : new Date(),
        });
      }
    };
    window.addEventListener('workforce:location-updated', handleLocEvent);
    return () => window.removeEventListener('workforce:location-updated', handleLocEvent);
  }, []);

  // Perform browser GPS location scan and refresh
  const handleManualLocationRefresh = async () => {
    if (locScanning) return;
    setLocScanning(true);
    setErrorMsg('');
    try {
      const pos = await getGPSPosition(true);
      const { latitude, longitude, accuracy } = pos.coords;
      await apiUpdateLocationFull(latitude, longitude, accuracy);
      const newLoc = {
        latitude,
        longitude,
        accuracy,
        updated_at: new Date(),
      };
      setLiveLocation(newLoc);
      try {
        const res = await apiGeofenceCheck(latitude, longitude);
        setGeoStatus({
          allowed: res.allowed,
          distance_m: res.distance_m,
          message: res.allowed
            ? `Authorized: ${res.matched_location || 'Site In-Bounds'} (${res.distance_m ?? 0}m)`
            : `Outside Bounds: ${res.reason || 'Distance Exceeds Limit'}`,
        });
      } catch (_) {}
      if (onStatusChange) onStatusChange();
      window.dispatchEvent(
        new CustomEvent('workforce:location-updated', {
          detail: {
            latitude,
            longitude,
            accuracy,
            timestamp: pos.timestamp || Date.now(),
            source: 'card_refresh',
          },
        })
      );
    } catch (err) {
      setErrorMsg(err.message || 'Location permission required or GPS request timed out.');
    } finally {
      setLocScanning(false);
    }
  };

  // Check if location is older than 5 minutes (300 seconds)
  const isLocStale = liveLocation?.updated_at
    ? (Date.now() - new Date(liveLocation.updated_at).getTime()) / 1000 > 300
    : false;

  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm text-slate-800">
      {/* Top Header Strip */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded border ${isClockedIn ? (activeBreak ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700') : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
            <Clock className={`w-5 h-5 ${isClockedIn && !activeBreak ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              Shift & Attendance Tracker
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isClockedIn ? (activeBreak ? `ON ${activeBreak.toUpperCase()} BREAK` : 'SHIFT ACTIVE') : 'NOT CLOCKED IN'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-2xl font-mono font-bold text-blue-700">{formatTimer(elapsedSeconds)}</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Shift Time</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Real-Time Location Status Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                Location Telemetry
              </span>
              {liveLocation ? (
                isLocStale ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Location needs refresh</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Current location available</span>
                  </span>
                )
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-slate-500" />
                  <span>Location unavailable</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleManualLocationRefresh}
              disabled={locScanning}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-700 transition-colors inline-flex items-center gap-1.5 shadow-xs self-start sm:self-auto disabled:opacity-50"
            >
              {locScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Scanning GPS...</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>{liveLocation ? 'Refresh Location' : 'Enable Location'}</span>
                </>
              )}
            </button>
          </div>

          {liveLocation ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-200/60">
              <span>
                Coordinates: <strong className="text-slate-900">{Number(liveLocation.latitude).toFixed(5)}, {Number(liveLocation.longitude).toFixed(5)}</strong>
              </span>
              {liveLocation.accuracy != null && (
                <span>
                  Accuracy: <strong className="text-slate-900">± {Math.round(liveLocation.accuracy)} m</strong>
                </span>
              )}
              {liveLocation.updated_at && (
                <span>
                  Updated: <strong className="text-slate-900">{new Date(liveLocation.updated_at).toLocaleTimeString()}</strong>
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              Click &quot;Enable Location&quot; to scan your current GPS position and refresh your proximity eligibility for job dispatch.
            </p>
          )}
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Primary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {!isClockedIn ? (
            <button
              type="button"
              onClick={handleClockIn}
              disabled={loading}
              className="w-full py-2 px-4 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>Clock In (Verify GPS)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClockOut}
              disabled={loading}
              className="w-full py-2 px-4 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Clock className="w-4 h-4" />
              <span>Clock Out of Shift</span>
            </button>
          )}

          {isClockedIn && (
            <div>
              {!activeBreak ? (
                <button
                  type="button"
                  onClick={() => setShowBreakModal(true)}
                  disabled={loading}
                  className="w-full py-2 px-4 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Coffee className="w-4 h-4 text-amber-700" />
                  <span>Take Break</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleBreakAction(activeBreak)}
                  disabled={loading}
                  className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>End {activeBreak.toUpperCase()} Break</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Break Selection Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-sm space-y-4 shadow-xl">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <Coffee className="w-4 h-4 text-amber-600" />
              Select Break Type
            </h4>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => handleBreakAction('tea')}
                className="w-full p-2.5 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 text-left font-semibold text-slate-800 flex items-center justify-between transition-colors"
              >
                <span>Tea Break</span>
                <span className="text-[10px] text-slate-500 font-mono">15 mins</span>
              </button>
              <button
                type="button"
                onClick={() => handleBreakAction('lunch')}
                className="w-full p-2.5 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 text-left font-semibold text-slate-800 flex items-center justify-between transition-colors"
              >
                <span>Lunch Break</span>
                <span className="text-[10px] text-slate-500 font-mono">45 mins</span>
              </button>
              <button
                type="button"
                onClick={() => handleBreakAction('personal')}
                className="w-full p-2.5 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 text-left font-semibold text-slate-800 flex items-center justify-between transition-colors"
              >
                <span>Personal Break</span>
                <span className="text-[10px] text-slate-500 font-mono">Flexible</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBreakModal(false)}
              className="w-full py-1.5 text-center text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
