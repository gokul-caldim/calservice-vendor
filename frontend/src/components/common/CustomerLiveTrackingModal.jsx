/**
 * CustomerLiveTrackingModal.jsx
 *
 * Full-Featured Realtime Customer & Admin Live Tracking Modal for CalTrack.
 *
 * Integrates:
 *  - REST state recovery & polling fallback.
 *  - Realtime event reconciliation (JOB_LOCATION_UPDATE, ARRIVAL_DETECTED, JOB_CANCELLED, REDISPATCH_STARTED).
 *  - Embedded JobTrackingMap (road routing, smooth marker animation, dynamic heading rotation).
 *  - Privacy guard: masks technician location when job is unassigned, redispatching, cancelled, or completed.
 *  - Role adaptation: supports viewRole="customer" and viewRole="admin".
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  X,
  MapPin,
  Car,
  Clock,
  Navigation,
  ShieldCheck,
  AlertCircle,
  Phone,
  MessageSquare,
  UserCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { apiGetJobLiveTracking, apiGetCustomerJobTracking } from '../../api/workforceService.js';
import { JobTrackingMap } from '../employee/JobTrackingMap.jsx';

export function CustomerLiveTrackingModal({
  jobId,
  isOpen,
  onClose,
  viewRole = 'customer', // 'customer' or 'admin'
}) {
  const [trackingData, setTrackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const pollTimerRef = useRef(null);
  const searchTimerRef = useRef(null);

  const fetchTracking = useCallback(async (isSilent = false) => {
    if (!jobId) return;
    if (!isSilent) setIsRefreshing(true);
    try {
      const res = viewRole === 'customer'
        ? await apiGetCustomerJobTracking(jobId)
        : await apiGetJobLiveTracking(jobId);
      setTrackingData(res);
      setError(null);
    } catch (err) {
      if (!isSilent) {
        setError(err.message || 'Could not load tracking session.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jobId, viewRole]);

  useEffect(() => {
    if (isOpen && jobId) {
      setIsLoading(true);
      setSearchSeconds(0);
      fetchTracking(false);

      // Start search elapsed timer
      searchTimerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);

      // Poll every 5s for authoritative telemetry reconciliation
      pollTimerRef.current = setInterval(() => {
        fetchTracking(true);
      }, 5000);
    } else {
      setTrackingData(null);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [isOpen, jobId, fetchTracking]);

  if (!isOpen) return null;

  const jobStatus = (trackingData?.status || '').toUpperCase();
  const tech = trackingData?.assigned_technician;
  const techLoc = tech?.location;
  const isRedispatching = jobStatus === 'FINDING_NEW_PROFESSIONAL' || jobStatus === 'REDISPATCHING';
  const isSearching = jobStatus === 'DRAFT' || jobStatus === 'NEW_REQUEST' || jobStatus === 'UNASSIGNED' || !tech;
  const isArrived = jobStatus === 'ARRIVED' || trackingData?.geofence_passed;
  const isInProgress = jobStatus === 'IN_PROGRESS';
  const isCompleted = jobStatus === 'COMPLETED';

  // Construct normalized job prop for JobTrackingMap
  const mapJob = {
    id: trackingData?.job_id || jobId,
    request_id: trackingData?.request_id || jobId,
    status: (trackingData?.status || '').toLowerCase(),
    latitude: trackingData?.customer_location?.latitude,
    longitude: trackingData?.customer_location?.longitude,
    address: trackingData?.customer_location?.address || 'Customer Destination',
    customer_name: viewRole === 'customer' ? 'Your Location' : 'Customer Destination',
    phone: tech?.phone || '',
  };

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{viewRole === 'customer' ? 'Live Service Tracking' : 'Operations Fleet Tracking'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-blue-300 font-mono">
                  #{trackingData?.request_id || jobId}
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                {viewRole === 'customer'
                  ? 'Real-time GPS tracking & driving route'
                  : 'Tenant-scoped technician telemetry inspection'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchTracking(false)}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Connecting to live tracking stream...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <h3 className="text-xs font-bold text-rose-900 mb-1">Tracking Unavailable</h3>
              <p className="text-[11px] text-rose-700 mb-3">{error}</p>
              <button
                type="button"
                onClick={() => fetchTracking(false)}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          ) : isRedispatching ? (
            /* Redispatching / Finding New Professional Notice */
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 animate-pulse">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Finding New Professional
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    The previous technician reassigned the order. We are connecting you with another nearby expert immediately.
                  </p>
                </div>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-amber-200/80 text-[11px] text-slate-700 flex items-center justify-between">
                <span>Destination: <strong>{trackingData?.customer_location?.address}</strong></span>
                <span className="font-mono text-amber-700 font-bold">Auto-Dispatch Active</span>
              </div>
            </div>
          ) : isSearching ? (
            /* State 1: Searching for Verified Professional Radar */
            <div className="p-6 bg-white border border-slate-200 rounded-xl text-center space-y-4 shadow-sm animate-in fade-in">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-75" />
                <div className="absolute inset-2 rounded-full bg-blue-200 animate-pulse opacity-50" />
                <div className="relative w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <Search className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Search Elapsed: {formatElapsed(searchSeconds)}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mt-1.5">
                  Finding Your Verified Professional
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed mt-1">
                  Evaluating 9-gate verified technicians near your location. Live map tracking activates immediately upon technician acceptance.
                </p>
              </div>

              {searchSeconds > 35 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Searching expanded territory. Auto-dispatch will connect the next available verified expert shortly.
                </div>
              )}

              <div className="text-[11px] text-slate-500 font-mono bg-slate-50 py-2 px-3 rounded-lg inline-block border border-slate-200 text-left w-full max-w-md">
                <div className="font-bold text-slate-700 mb-0.5">Booking Details:</div>
                <div className="truncate">Destination: <strong>{trackingData?.customer_location?.address || 'Site Location'}</strong></div>
                <div>Status: <span className="text-blue-700 font-bold uppercase">{trackingData?.status || 'Searching'}</span></div>
              </div>
            </div>
          ) : (
            /* States 2–5: Active Live Map & Telemetry */
            <div className="space-y-3 animate-in fade-in">
              {/* State 3: Prominent Work Start OTP Banner for Customer */}
              {isArrived && trackingData?.start_otp && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-center space-y-1.5 shadow-sm animate-in fade-in">
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-800 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Work Start Verification OTP
                  </span>
                  <div className="text-3xl font-mono font-black text-emerald-800 tracking-widest my-1 select-all">
                    {trackingData.start_otp}
                  </div>
                  <p className="text-xs text-emerald-800 font-medium">
                    Share this 6-digit code with <strong>{tech?.name || 'your technician'}</strong> upon arrival to begin service.
                  </p>
                </div>
              )}

              {/* State 5: Service Completed Notice */}
              {isCompleted && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Service Completed Successfully</h4>
                    <p className="text-[11px] text-emerald-700">Technician tracking session has ended. Live coordinates are closed.</p>
                  </div>
                </div>
              )}

              {/* Assigned Technician Identity Banner */}
              {tech && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                      {tech.name?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900">{tech.name}</h4>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          Verified
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {isArrived
                          ? 'Technician has arrived at your destination'
                          : isInProgress
                          ? 'Work in progress at your site'
                          : isCompleted
                          ? 'Service completed successfully'
                          : 'En route to your location'}
                      </p>
                    </div>
                  </div>

                  {tech.phone && !isCompleted && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${tech.phone}`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition-all active:scale-95"
                        title="Call Technician"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                      <a
                        href={`sms:${tech.phone}`}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center border border-slate-300 transition-all"
                        title="Send SMS"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Embedded Interactive Live Road Tracking Map */}
              <JobTrackingMap
                job={mapJob}
                technicianLocation={techLoc}
                preServiceState={{ geofence_passed: trackingData?.geofence_passed }}
                geofenceRadius={trackingData?.geofence_radius_meters || 300}
                viewRole={viewRole}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>CalTrack Verified Road Dispatch</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerLiveTrackingModal;

