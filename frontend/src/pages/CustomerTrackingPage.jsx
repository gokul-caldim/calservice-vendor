/**
 * CustomerTrackingPage.jsx
 *
 * Dedicated customer-facing live technician tracking experience.
 * Route: /track/:jobId
 *
 * Consumes:
 *   GET /api/workforce/jobs/<jobId>/live-tracking/
 *
 * Features:
 *   - Clean, modern customer service-tracking UI (Uber / Swiggy / Urban Company style)
 *   - 5-second polling interval (auto-stopped on unmount, completed, or cancelled status)
 *   - Safe request deduplication
 *   - Customer-friendly status timeline
 *   - Real-time road route and ETA
 *   - Technician profile card (dynamic name, initials/photo, rating if available, Call/WhatsApp if phone available)
 *   - Formatted customer service location card
 *   - Robust error & auth states (401, 403, 404, network failure)
 *   - Zero workforce operational controls or GPS diagnostics exposed
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  RefreshCw,
  Lock,
  User,
  Car,
  Home,
} from 'lucide-react';
import { apiGetJobLiveTracking } from '../api/customerTrackingApi.js';
import { CustomerTrackingMap } from '../components/customer/CustomerTrackingMap.jsx';

// Helper to generate initials from full name
function getInitials(name) {
  if (!name) return 'SP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CustomerTrackingPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // { type: '401'|'403'|'404'|'network'|'unknown', message: '' }
  const [trackingData, setTrackingData] = useState(null);
  const [roadMetrics, setRoadMetrics] = useState({ etaText: null, distanceText: null });

  const isPollingRef = useRef(false);
  const pollTimerRef = useRef(null);

  // Fetch tracking data with deduplication
  const fetchTracking = useCallback(async (isInitial = false) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const data = await apiGetJobLiveTracking(jobId);
      setTrackingData(data);
      setErrorState(null);
    } catch (err) {
      const status = err.status || (err.response && err.response.status);
      if (status === 401) {
        setErrorState({
          type: '401',
          message: 'Please sign in to track this service booking.',
        });
      } else if (status === 403) {
        setErrorState({
          type: '403',
          message: "You don't have access to track this service booking.",
        });
      } else if (status === 404) {
        setErrorState({
          type: '404',
          message: 'Service booking not found. Please check your booking link.',
        });
      } else {
        if (isInitial) {
          setErrorState({
            type: 'network',
            message: 'We could not load the live tracking information. Please check your connection.',
          });
        }
      }
    } finally {
      isPollingRef.current = false;
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [jobId]);

  // Initial Load & Polling Lifecycle
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorState(null);

    // Initial fetch
    fetchTracking(true);

    // Polling interval (5s)
    pollTimerRef.current = setInterval(() => {
      if (!isMounted) return;
      // Stop polling if completed or cancelled
      setTrackingData((currentData) => {
        const status = (currentData?.status || '').toLowerCase();
        if (status === 'completed' || status === 'cancelled' || status === 'closed') {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        } else {
          fetchTracking(false);
        }
        return currentData;
      });
    }, 5000);

    return () => {
      isMounted = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobId, fetchTracking]);

  // Callback when Google Maps calculates route ETA
  const handleEtaCalculated = useCallback(({ etaText, distanceText }) => {
    setRoadMetrics({ etaText, distanceText });
  }, []);

  const rawStatus = (trackingData?.status || 'PENDING').toLowerCase();
  const tech = trackingData?.assigned_technician;
  const techCoords = tech?.location;
  const custLoc = trackingData?.customer_location;
  const freshness = trackingData?.freshness_state || 'LOCATION_LOST';

  // Customer-friendly ETA resolution
  const displayEta = useMemo(() => {
    if (rawStatus === 'completed') return 'Service Completed';
    if (rawStatus === 'cancelled') return 'Booking Cancelled';
    if (rawStatus === 'arrived') return 'Technician has arrived';
    if (rawStatus === 'in_progress') return 'Service in progress';

    if (roadMetrics.etaText) {
      return `Arriving in ${roadMetrics.etaText}`;
    }

    if (trackingData?.distance_m != null) {
      if (trackingData.distance_m <= 300) {
        return 'Arriving soon';
      }
      const approxMin = Math.max(1, Math.round((trackingData.distance_m / 1000) * 3));
      return `Arriving in ~${approxMin} min`;
    }

    return 'Calculating ETA...';
  }, [rawStatus, roadMetrics.etaText, trackingData?.distance_m]);

  // Customer-friendly Headline Status Message
  const statusHeadline = useMemo(() => {
    if (rawStatus === 'completed') {
      return { title: 'Service Completed', subtitle: 'Thank you for choosing CalServices!', tone: 'emerald' };
    }
    if (rawStatus === 'cancelled') {
      return { title: 'Booking Cancelled', subtitle: 'This service request was cancelled.', tone: 'rose' };
    }
    if (rawStatus === 'in_progress') {
      return { title: 'Service in Progress', subtitle: 'Your technician is currently performing the service.', tone: 'blue' };
    }
    if (rawStatus === 'arrived') {
      return { title: 'Technician Has Arrived', subtitle: 'Your service partner has arrived at your location.', tone: 'emerald' };
    }
    if (rawStatus === 'on_the_way') {
      if (freshness === 'STALE' || freshness === 'LOCATION_LOST') {
        return { title: 'Technician is on the way', subtitle: "Technician location hasn't updated recently", tone: 'amber' };
      }
      return { title: 'Technician is on the way', subtitle: 'Driving to your service location', tone: 'blue' };
    }
    if (rawStatus === 'accepted') {
      return { title: 'Technician Assigned', subtitle: 'Your service partner is preparing to depart', tone: 'blue' };
    }
    return { title: 'Booking Confirmed', subtitle: 'We are assigning the best technician for your service', tone: 'slate' };
  }, [rawStatus, freshness]);

  // Status timeline steps
  const timelineSteps = useMemo(() => {
    const steps = [
      { key: 'confirmed', label: 'Booking Confirmed' },
      { key: 'assigned', label: 'Technician Assigned' },
      { key: 'on_the_way', label: 'On The Way' },
      { key: 'arrived', label: 'Technician Arrived' },
      { key: 'in_progress', label: 'Service In Progress' },
      { key: 'completed', label: 'Service Completed' },
    ];

    const getStepIndex = (st) => {
      switch (st) {
        case 'pending':
        case 'confirmed':
          return 0;
        case 'accepted':
          return 1;
        case 'on_the_way':
          return 2;
        case 'arrived':
          return 3;
        case 'in_progress':
          return 4;
        case 'completed':
          return 5;
        case 'cancelled':
          return -1;
        default:
          return 0;
      }
    };

    const activeIndex = getStepIndex(rawStatus);

    return steps.map((step, idx) => {
      let state = 'upcoming';
      if (rawStatus === 'cancelled') {
        state = 'cancelled';
      } else if (idx < activeIndex) {
        state = 'completed';
      } else if (idx === activeIndex) {
        state = 'current';
      }
      return { ...step, state };
    });
  }, [rawStatus]);

  // Render Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-sm font-bold text-slate-800">Loading live tracking...</h3>
          <p className="text-xs text-slate-500 mt-1">Connecting to your service technician</p>
        </div>
      </div>
    );
  }

  // Render Error States
  if (errorState) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center max-w-md w-full text-center">
          {errorState.type === '401' ? (
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
          ) : errorState.type === '403' ? (
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
          )}

          <h2 className="text-base font-bold text-slate-900 mb-1">
            {errorState.type === '401'
              ? 'Authentication Required'
              : errorState.type === '403'
              ? 'Access Restricted'
              : errorState.type === '404'
              ? 'Booking Not Found'
              : 'Tracking Unavailable'}
          </h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            {errorState.message}
          </p>

          <div className="flex items-center gap-3 w-full">
            {errorState.type === '401' ? (
              <Link
                to="/workforce/login"
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md text-center"
              >
                Sign In
              </Link>
            ) : errorState.type === 'network' ? (
              <button
                type="button"
                onClick={() => fetchTracking(true)}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all text-center"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const techPhoto = trackingData?.technician_photo || tech?.photo;
  const techRating = trackingData?.technician_rating ?? tech?.rating;
  const techName = tech?.name || 'Service Partner';
  const techPhone = tech?.phone || '';
  const techTitle = tech?.title || 'Service Partner';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors active:scale-95"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Track Your Technician</span>
              </h1>
              <p className="text-[11px] text-slate-500">
                Booking #{trackingData?.request_id || jobId}
              </p>
            </div>
          </div>

          {/* Live Status Badge */}
          <div className="flex items-center gap-2">
            {rawStatus !== 'completed' && rawStatus !== 'cancelled' && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                  freshness === 'LIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : freshness === 'UPDATING'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : freshness === 'DELAYED'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {freshness === 'LIVE' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                {freshness === 'UPDATING' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                <span>{freshness === 'LIVE' ? 'LIVE' : freshness === 'UPDATING' ? 'UPDATING' : freshness === 'DELAYED' ? 'DELAYED' : 'TRACKING'}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Tracking Body ── */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* ── Hero Status & ETA Banner ── */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                statusHeadline.tone === 'emerald' ? 'bg-emerald-500' :
                statusHeadline.tone === 'blue' ? 'bg-blue-600' :
                statusHeadline.tone === 'amber' ? 'bg-amber-500' :
                statusHeadline.tone === 'rose' ? 'bg-rose-500' : 'bg-slate-400'
              }`} />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {statusHeadline.title}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {statusHeadline.subtitle}
            </p>
          </div>

          {/* ETA Block */}
          {rawStatus !== 'completed' && rawStatus !== 'cancelled' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Estimated Arrival
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {displayEta}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Live Map Component ── */}
        <CustomerTrackingMap
          technicianCoords={techCoords}
          serviceLocation={custLoc}
          technicianInfo={{
            name: techName,
            title: techTitle,
            rating: techRating,
            phone: techPhone,
            photo: techPhoto,
          }}
          jobStatus={rawStatus}
          onEtaCalculated={handleEtaCalculated}
        />

        {/* ── Technician & Contact Card ── */}
        {tech && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Technician Avatar / Initials */}
                {techPhoto ? (
                  <img
                    src={techPhoto}
                    alt={techName}
                    className="w-13 h-13 rounded-2xl object-cover border-2 border-slate-100 shadow-xs"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                    {getInitials(techName)}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {techName}
                    </h3>
                    {techRating != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200">
                        ★ {techRating}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {techTitle}
                  </p>
                </div>
              </div>

              {/* Contact Actions (rendered only if phone number is provided) */}
              {techPhone && (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${techPhone}`}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${techPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Status Timeline ── */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Service Status Timeline</span>
          </h3>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timelineSteps.map((step) => {
              const isCompleted = step.state === 'completed';
              const isCurrent = step.state === 'current';
              const isCancelled = step.state === 'cancelled';

              return (
                <div key={step.key} className="relative flex items-center gap-3">
                  <div
                    className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCompleted
                        ? 'bg-blue-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                        : isCancelled
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {isCompleted ? '✓' : isCurrent ? '●' : '○'}
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? 'text-blue-600 font-bold'
                          : isCompleted
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Service Location Card ── */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Your Service Location
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 leading-snug">
                {custLoc?.address || 'Service Location Address'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CustomerTrackingPage;
