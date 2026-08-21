import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Coffee,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  RotateCw,
  X,
  Lock,
} from 'lucide-react';
import {
  apiClockOut,
  apiStartBreak,
  apiEndBreak,
  apiGetTimeTracking,
  apiGeofenceCheck,
} from '../../api/clockInApi.js';
import { useEmployeeRuntime } from '../../context/EmployeeRuntimeContext.jsx';
import { GPS_STATE } from '../../hooks/useGPSPosition.js';

export function ClockInCard({
  onStatusChange,
  activeJob,
  hasActiveJob,
}) {
  const {
    isOnline,
    gpsState,
    liveLocation,
    scanCurrentLocation,
    autoClockIn,
    getClockInReadiness,
  } = useEmployeeRuntime();

  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeBreak, setActiveBreak] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [geoStatus, setGeoStatus] = useState({ allowed: null, distance_m: null, message: 'Geofence Check Pending' });
  const [loading, setLoading] = useState(false);
  const [locScanning, setLocScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [clockInTime, setClockInTime] = useState(null);
  const [completedBreakSeconds, setCompletedBreakSeconds] = useState(0);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [serverActiveJob, setServerActiveJob] = useState(null);

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
        if (data.active_job) {
          setServerActiveJob(data.active_job);
        } else if (data.has_active_job === false) {
          setServerActiveJob(null);
        }

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

  // Auto-dismiss transient messages
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Shift timer tick
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

  // Perform location scan using runtime session scanner
  const handleManualLocationRefresh = async () => {
    if (locScanning) return;
    setLocScanning(true);
    setErrorMsg('');
    try {
      const newLoc = await scanCurrentLocation();
      if (newLoc) {
        try {
          const res = await apiGeofenceCheck(newLoc.latitude, newLoc.longitude);
          setGeoStatus({
            allowed: res.allowed,
            distance_m: res.distance_m,
            message: res.allowed
              ? `Authorized: ${res.matched_location || 'Site In-Bounds'} (${res.distance_m ?? 0}m)`
              : `Outside Bounds: ${res.reason || 'Distance Exceeds Limit'}`,
          });
        } catch (_) {}
      }
      if (onStatusChange) onStatusChange();
    } catch (err) {
      setErrorMsg(err.message || 'GPS scan failed. Check device location.');
    } finally {
      setLocScanning(false);
    }
  };

  const currentActiveJob = activeJob || serverActiveJob;
  const isCashPaymentPending = Boolean(
    currentActiveJob &&
    ['in_progress', 'proof_submitted'].includes((currentActiveJob.status || '').toLowerCase()) &&
    ((currentActiveJob.payment?.payment_method || currentActiveJob.payment_method || '').toUpperCase() === 'CASH_ON_SERVICE') &&
    !(currentActiveJob.payment?.is_cash_collected || currentActiveJob.is_cash_collected || currentActiveJob.payment?.payment_status === 'PAID' || currentActiveJob.payment_status === 'paid')
  );
  const readiness = getClockInReadiness(currentActiveJob, null, isClockedIn);

  // Perform Clock-In using centralized runtime action
  const handleClockIn = async () => {
    if (!currentActiveJob) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await autoClockIn(currentActiveJob.id);
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
      const lat = liveLocation?.latitude || null;
      const lon = liveLocation?.longitude || null;

      const res = await apiClockOut({ lat, lon });
      setIsClockedIn(false);
      setActiveBreak(null);
      setSuccessMsg(res.message || 'Clocked out of shift successfully.');
      await loadServerState();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      if (err.code === 'CASH_NOT_RECEIVED') {
        setErrorMsg(err.message || 'Cash payment must be collected and recorded before clocking out.');
      } else {
        setErrorMsg(err.message || 'Clock-out failed.');
      }
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

  const isLocStale = gpsState === GPS_STATE.STALE;
  const isLocLive = gpsState === GPS_STATE.LIVE || gpsState === GPS_STATE.GEOFENCE_READY;

  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm text-slate-800">
      {/* Top Header Strip */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded border ${
              isClockedIn
                ? activeBreak
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
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
        {/* Operational Status Block: Presence, Location, Dispatch Readiness */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                Location Telemetry
              </span>

              {/* Explicit GPS State Machine Badge */}
              {gpsState === GPS_STATE.GEOFENCE_READY ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>GPS LIVE & GEOFENCE READY (acc: {liveLocation?.accuracy ? `${liveLocation.accuracy}m` : 'high'})</span>
                </span>
              ) : gpsState === GPS_STATE.LIVE ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>GPS LIVE</span>
                </span>
              ) : gpsState === GPS_STATE.STALE ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>GPS STALE — Acquiring fresh fix</span>
                </span>
              ) : gpsState === GPS_STATE.PERMISSION_DENIED ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-500" />
                  <span>LOCATION PERMISSION DENIED</span>
                </span>
              ) : gpsState === GPS_STATE.ACQUIRING || gpsState === GPS_STATE.REQUESTING ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                  <span>ACQUIRING GPS FIX...</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                  GPS IDLE
                </span>
              )}

              {/* Dispatch Readiness Badge */}
              {isOnline ? (
                isLocLive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    DISPATCH ELIGIBLE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    WAITING FOR GPS
                  </span>
                )
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                  OFFLINE
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <div
                title="Single authoritative browser GPS watcher active"
                className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold shadow-xs inline-flex items-center gap-1.5 select-none"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Auto-GPS Active</span>
              </div>
              <button
                type="button"
                onClick={handleManualLocationRefresh}
                disabled={locScanning}
                title="Perform instant GPS telemetry scan"
                className="p-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-600 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${locScanning ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              </button>
            </div>
          </div>

          {liveLocation && (
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono">
                <span>
                  Coordinates:{' '}
                  <strong className="text-slate-900">
                    {Number(liveLocation.latitude).toFixed(5)}, {Number(liveLocation.longitude).toFixed(5)}
                  </strong>
                </span>
                {liveLocation.accuracy != null && (
                  <span>
                    Accuracy: <strong className="text-slate-900">&plusmn;{Math.round(liveLocation.accuracy)}m</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Readiness State Indicator */}
        {currentActiveJob && !isClockedIn && (
          <div
            className={`p-3 rounded border text-xs flex items-start gap-2.5 ${
              readiness.state === 'READY'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : readiness.state === 'OUTSIDE_GEOFENCE'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {readiness.state === 'READY' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : readiness.state === 'OUTSIDE_GEOFENCE' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold block">{readiness.label}</span>
              {readiness.reason && <p className="text-[11px] mt-0.5">{readiness.reason}</p>}
            </div>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="p-1 rounded hover:bg-rose-100 text-rose-700 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              className="p-1 rounded hover:bg-emerald-100 text-emerald-700 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Primary Actions */}
        <div className="space-y-3 pt-1">
          {!isClockedIn ? (
            currentActiveJob ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded bg-blue-50 border border-blue-200 text-xs">
                  <div>
                    <span className="font-bold text-blue-900">
                      Active Job #{currentActiveJob.request_id || currentActiveJob.id}
                    </span>
                    <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                      {currentActiveJob.issue_title || currentActiveJob.service_category || 'Assigned Service'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('arrival-verification-checklist');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition-colors shrink-0 shadow-xs active:scale-95"
                  >
                    Go to Verification Checklist &darr;
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Mandatory Before Clock-In: 1. Auto-Arrival (&le;250m) &bull; 2. Customer OTP &bull; 3. Presence Selfie
                </p>

                {readiness.canClockIn ? (
                  <div className="w-full py-2.5 px-4 rounded font-bold text-xs flex items-center justify-center gap-2 shadow-xs bg-emerald-50 border border-emerald-300 text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    <span>
                      {loading ? 'Clocking In...' : '✓ Pre-Verification Complete — Auto Clocking In...'}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('arrival-verification-checklist');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    disabled={true}
                    className="w-full py-2 px-4 rounded font-bold text-xs flex items-center justify-center gap-2 bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-75"
                  >
                    <Play className="w-4 h-4" />
                    <span>{`Clock In Locked (${readiness.label})`}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {isOnline ? 'Online — Available for Dispatch' : 'Technician Standby'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Waiting for customer job offers. Clock-in activates once you accept a job and arrive at the customer site.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-slate-200 text-slate-700 rounded self-start sm:self-auto shrink-0">
                    Standby
                  </span>
                </div>

                <button
                  type="button"
                  disabled={true}
                  className="w-full py-2 px-4 rounded bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-75"
                >
                  <Play className="w-4 h-4 text-slate-400" />
                  <span>Clock In (Disabled — No Active Job)</span>
                </button>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleClockOut}
                  disabled={loading || isCashPaymentPending}
                  title={isCashPaymentPending ? 'Cash payment must be collected and recorded before clocking out.' : 'Clock out of active shift'}
                  className={`w-full py-2 px-4 rounded font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs active:scale-95 ${
                    isCashPaymentPending
                      ? 'bg-slate-100 border border-slate-300 text-slate-400 cursor-not-allowed opacity-75'
                      : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{isCashPaymentPending ? 'Clock Out (Cash Pending)' : 'Clock Out of Shift'}</span>
                </button>

                <div>
                  {!activeBreak ? (
                    <button
                      type="button"
                      onClick={() => setShowBreakModal(true)}
                      disabled={loading}
                      className="w-full py-2 px-4 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Coffee className="w-4 h-4 text-amber-700" />
                      <span>Take Break</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleBreakAction(activeBreak)}
                      disabled={loading}
                      className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>End {activeBreak.toUpperCase()} Break</span>
                    </button>
                  )}
                </div>
              </div>
              {isCashPaymentPending && (
                <p className="text-[10.5px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                  ⚠️ Cash collection pending on active job. Collect & record cash in your active job view to enable clock-out.
                </p>
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
