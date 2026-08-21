/**
 * EmployeeRuntimeProvider.jsx
 *
 * Single persistent session runtime for the CalTrack Workforce employee application.
 * Incorporates Phase 2 Architecture Standards:
 * 1. ONE Authoritative GPS Implementation (session-level useLocationTracker)
 * 2. Explicit GPS State Machine (GPS_IDLE, GPS_REQUESTING, GPS_ACQUIRING, GPS_LIVE, GPS_GEOFENCE_READY, GPS_STALE, GPS_UNAVAILABLE, GPS_PERMISSION_DENIED, GPS_ERROR)
 * 3. Fast presence toggle decoupled from GPS acquisition
 * 4. Centralized background auto-arrival detection (<= 250m) with in-flight coalescing
 * 5. Single controlled autoClockIn runtime action with idempotency protection
 * 6. Explicit Clock-In readiness state engine
 * 7. Zero Customer Impact & Preserved API Contracts
 * 8. Stale-While-Revalidate Active Job Cache + Out-of-Order Generation Protection
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { EmployeeRuntimeContext, ACTIVE_QUEUE_STATUSES } from './EmployeeRuntimeContext.jsx';
import {
  apiGetWorkforceJobs,
  apiGetNotifications,
  apiMarkNotificationRead,
  apiClearNotifications,
  apiUpdateLocationFull,
  apiVerifyArrival,
} from '../api/workforceService.js';
import { apiClockIn } from '../api/clockInApi.js';
import {
  useLocationTracker,
  getGPSPosition,
  GPS_STATE,
  computeGpsState,
  haversineMetres,
  MAX_GEOFENCE_ACCURACY_METERS,
} from '../hooks/useGPSPosition.js';
import { useRealtimeStream } from '../hooks/useRealtimeStream.js';

export function EmployeeRuntimeProvider({ children }) {
  const { user, isEmployee, registrationStatus, togglePresence: authTogglePresence, logout, isAuthenticated } = useAuth();

  const isApprovedEmployee = Boolean(user && isEmployee && registrationStatus === 'approved');
  const isOnlineAuth = Boolean(user?.isOnline);

  // ── 1. Presence & GPS State Machine ─────────────────────────────────────────
  const [presenceState, setPresenceState] = useState(() => {
    if (!isOnlineAuth) return 'OFFLINE';
    const loc = user?.last_known_location;
    if (loc?.latitude && loc?.longitude) return 'ONLINE_GPS_LIVE';
    return 'ONLINE_LOCATION_PENDING';
  });

  const [gpsState, setGpsState] = useState(() => {
    if (!isOnlineAuth) return GPS_STATE.IDLE;
    const loc = user?.last_known_location;
    if (loc?.latitude && loc?.longitude) return computeGpsState(loc);
    return GPS_STATE.ACQUIRING;
  });

  const isOnline = presenceState !== 'OFFLINE' && presenceState !== 'CONNECTING';
  const isGpsLive = gpsState === GPS_STATE.LIVE || gpsState === GPS_STATE.GEOFENCE_READY;
  const isGpsGeofenceReady = gpsState === GPS_STATE.GEOFENCE_READY;
  const isLocationPending = gpsState === GPS_STATE.ACQUIRING || gpsState === GPS_STATE.REQUESTING;

  useEffect(() => {
    if (!isOnlineAuth) {
      setPresenceState('OFFLINE');
      setGpsState(GPS_STATE.IDLE);
    } else {
      setPresenceState((prev) => (prev === 'OFFLINE' ? 'ONLINE_LOCATION_PENDING' : prev));
      setGpsState((prev) => (prev === GPS_STATE.IDLE ? GPS_STATE.ACQUIRING : prev));
    }
  }, [isOnlineAuth]);

  // ── 2. Jobs State & Cache (Stale-While-Revalidate) ───────────────────────────
  const [activeJobs, setActiveJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [isCompletedLoading, setIsCompletedLoading] = useState(false);
  const [jobsError, setJobsError] = useState(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const fetchGenerationRef = useRef(0);
  const inFlightActiveJobsPromiseRef = useRef(null);
  const inFlightCompletedJobsPromiseRef = useRef(null);
  const activeJobsRef = useRef([]);
  const selectedJobRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    activeJobsRef.current = activeJobs;
  }, [activeJobs]);

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  const hasActiveJob = useMemo(() => {
    return activeJobs.some((j) => {
      const st = (j.status || j.job_status || '').toLowerCase();
      const isAssigned = Boolean(j.is_assigned_to_current_employee || j.assigned_employee_id === user?.id);
      return isAssigned && ACTIVE_QUEUE_STATUSES.includes(st);
    });
  }, [activeJobs, user?.id]);

  const incomingOffers = useMemo(() => {
    const currentNow = Date.now() + (serverTimeOffset || 0);
    return activeJobs.filter((j) => {
      const isOffer = j.is_offer === true || j.active_offer?.status === 'OFFERED';
      if (!isOffer || j.is_assigned_to_current_employee) return false;
      const expStr = j.offer_expires_at || j.active_offer?.expires_at;
      if (expStr) {
        const expMs = Date.parse(expStr);
        if (!isNaN(expMs) && expMs <= currentNow) {
          return false;
        }
      }
      return !j.active_offer?.is_expired;
    });
  }, [activeJobs, serverTimeOffset]);

  const incomingOffer = useMemo(() => {
    return incomingOffers[0] || null;
  }, [incomingOffers]);

  // ── 3. Notification Deduplication ──────────────────────────────────────────
  const knownOfferIdsRef = useRef(new Set());
  const isInitialOffersLoadedRef = useRef(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOnline && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isOnline]);

  const triggerOfferBrowserNotification = useCallback((offeredJob) => {
    if (!offeredJob) return;
    const offerId = offeredJob.active_offer?.id || offeredJob.offer_id || `job_${offeredJob.id}`;

    if (knownOfferIdsRef.current.has(offerId)) {
      return;
    }
    knownOfferIdsRef.current.add(offerId);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = '⚡ New Exclusive Job Offer!';
        const body = `Job #${offeredJob.request_id || offeredJob.id}: ${
          offeredJob.service_title || offeredJob.service_category || 'Service Request'
        }. Tap to review and accept.`;
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `offer_${offerId}`,
        });
      } catch (_) {}
    }
  }, []);

  // ── Scheduled Local Expiry Timer for Active Offers ─────────────────────────
  const expiryTimerRef = useRef(null);

  const refreshActiveJobs = useCallback(
    async (options = {}) => {
      const isSilent = options?.silent === true;
      const force = options?.force === true;

      if (inFlightActiveJobsPromiseRef.current && !force) {
        return inFlightActiveJobsPromiseRef.current;
      }

      if (!isSilent && activeJobsRef.current.length === 0) {
        setIsJobsLoading(true);
      }
      setJobsError(null);

      const currentGen = ++fetchGenerationRef.current;

      const fetchPromise = (async () => {
        try {
          const jobsData = await apiGetWorkforceJobs('active');

          if (currentGen < fetchGenerationRef.current) {
            console.info(`[EmployeeRuntime] Discarding stale active jobs response (gen #${currentGen} < #${fetchGenerationRef.current})`);
            return activeJobsRef.current;
          }

          if (Array.isArray(jobsData)) {
            setActiveJobs(jobsData);

            const serverTimeStr = jobsData[0]?.server_time || jobsData[0]?.active_offer?.server_time;
            if (serverTimeStr) {
              const sTime = Date.parse(serverTimeStr);
              if (!isNaN(sTime)) {
                setServerTimeOffset(sTime - Date.now());
              }
            }

            // Filter all currently valid incoming offers
            const validOffers = jobsData.filter(
              (j) =>
                (j.is_offer === true || j.active_offer?.status === 'OFFERED') &&
                !j.active_offer?.is_expired &&
                !j.is_assigned_to_current_employee
            );

            if (!isInitialOffersLoadedRef.current) {
              // Seed ALL initial offers to prevent duplicate notification triggers on initial mount
              validOffers.forEach((offer) => {
                const offerId = offer.active_offer?.id || offer.offer_id || `job_${offer.id}`;
                knownOfferIdsRef.current.add(offerId);
              });
              isInitialOffersLoadedRef.current = true;
            } else {
              // Trigger notification ONLY for genuinely new offer IDs
              validOffers.forEach((offer) => {
                const offerId = offer.active_offer?.id || offer.offer_id || `job_${offer.id}`;
                if (!knownOfferIdsRef.current.has(offerId)) {
                  knownOfferIdsRef.current.add(offerId);
                  triggerOfferBrowserNotification(offer);
                }
              });
            }

            const currentOffer = validOffers[0] || null;

            setSelectedJob((prev) => {
              if (!prev) {
                if (currentOffer) return currentOffer;
                const active = jobsData.find((j) =>
                  ACTIVE_QUEUE_STATUSES.includes((j.status || j.job_status || '').toLowerCase())
                );
                return active || jobsData[0] || null;
              }
              const updated = jobsData.find((j) => j.id === prev.id);
              return updated || prev;
            });
            return jobsData;
          }
          return activeJobsRef.current;
        } catch (err) {
          console.warn('[EmployeeRuntime] Background active jobs refresh error:', err);
          setJobsError(err.message || 'Unable to update jobs.');
          return activeJobsRef.current;
        } finally {
          setIsJobsLoading(false);
          inFlightActiveJobsPromiseRef.current = null;
        }
      })();

      inFlightActiveJobsPromiseRef.current = fetchPromise;
      return fetchPromise;
    },
    [triggerOfferBrowserNotification]
  );

  useEffect(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    const offers = activeJobs.filter(
      (j) =>
        (j.is_offer === true || j.active_offer?.status === 'OFFERED') &&
        !j.is_assigned_to_current_employee
    );

    if (offers.length === 0) return;

    let earliestExpiryMs = Infinity;
    for (const job of offers) {
      const expStr = job.offer_expires_at || job.active_offer?.expires_at;
      if (expStr) {
        const expMs = Date.parse(expStr);
        if (!isNaN(expMs) && expMs < earliestExpiryMs) {
          earliestExpiryMs = expMs;
        }
      }
    }

    if (earliestExpiryMs === Infinity) return;

    const nowWithOffset = Date.now() + (serverTimeOffset || 0);
    const delayMs = Math.max(0, earliestExpiryMs - nowWithOffset);

    expiryTimerRef.current = setTimeout(() => {
      console.info('[EmployeeRuntime] Scheduled offer expiry reached. Reconciling UI.');
      setActiveJobs((prev) =>
        prev.filter((j) => {
          const expStr = j.offer_expires_at || j.active_offer?.expires_at;
          if (expStr) {
            const expMs = Date.parse(expStr);
            const currentNow = Date.now() + (serverTimeOffset || 0);
            if (!isNaN(expMs) && expMs <= currentNow && !j.is_assigned_to_current_employee) {
              return false;
            }
          }
          return true;
        })
      );

      setSelectedJob((prev) => {
        if (!prev) return null;
        const expStr = prev.offer_expires_at || prev.active_offer?.expires_at;
        if (expStr) {
          const expMs = Date.parse(expStr);
          const currentNow = Date.now() + (serverTimeOffset || 0);
          if (!isNaN(expMs) && expMs <= currentNow && !prev.is_assigned_to_current_employee) {
            return null;
          }
        }
        return prev;
      });

      refreshActiveJobs({ silent: true });
    }, delayMs);

    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [activeJobs, serverTimeOffset, refreshActiveJobs]);

  // ── 5. Completed Jobs Fetch ────────────────────────────────────────────────
  const refreshCompletedJobs = useCallback(async (options = {}) => {
    const isSilent = options?.silent === true;
    if (inFlightCompletedJobsPromiseRef.current) {
      return inFlightCompletedJobsPromiseRef.current;
    }

    if (!isSilent) setIsCompletedLoading(true);

    const fetchPromise = (async () => {
      try {
        const completedData = await apiGetWorkforceJobs('completed');
        if (Array.isArray(completedData)) {
          setCompletedJobs(completedData);
          return completedData;
        }
        return [];
      } catch (err) {
        console.warn('[EmployeeRuntime] Completed jobs fetch error:', err);
        return [];
      } finally {
        setIsCompletedLoading(false);
        inFlightCompletedJobsPromiseRef.current = null;
      }
    })();

    inFlightCompletedJobsPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  const scheduleCoalescedRefresh = useCallback(
    (delayMs = 400) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        refreshActiveJobs({ silent: true });
      }, delayMs);
    },
    [refreshActiveJobs]
  );

  // ── 6. Notification Sync ───────────────────────────────────────────────────
  const syncNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiGetNotifications();
      if (res) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      }
    } catch (_) {}
  }, [isAuthenticated]);

  const markNotificationAsRead = useCallback(
    async (notificationId = null) => {
      try {
        await apiMarkNotificationRead(notificationId);
        await syncNotifications();
      } catch (_) {}
    },
    [syncNotifications]
  );

  const clearAllNotifications = useCallback(
    async (notificationIds = []) => {
      try {
        await apiClearNotifications(notificationIds);
        await syncNotifications();
      } catch (_) {}
    },
    [syncNotifications]
  );

  useEffect(() => {
    if (isAuthenticated && isApprovedEmployee) {
      refreshActiveJobs();
      syncNotifications();
    }
  }, [isAuthenticated, isApprovedEmployee, refreshActiveJobs, syncNotifications]);

  // ── 7. Single Authoritative Live GPS Watcher ───────────────────────────────
  const [liveLocation, setLiveLocation] = useState(() => {
    const loc = user?.last_known_location;
    if (loc?.latitude && loc?.longitude) {
      return {
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        accuracy: loc.accuracy || null,
        timestamp: Date.now(),
      };
    }
    return null;
  });

  const isUpdatingLocationRef = useRef(false);

  const handlePositionChange = useCallback(async (payload) => {
    const newLoc = {
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      speed: payload.speed,
      heading: payload.heading,
      timestamp: payload.timestamp || Date.now(),
      captured_at: payload.captured_at || new Date().toISOString(),
    };
    setLiveLocation(newLoc);
    setPresenceState('ONLINE_GPS_LIVE');
    setGpsState(payload.is_geofence_ready ? GPS_STATE.GEOFENCE_READY : GPS_STATE.LIVE);

    if (isUpdatingLocationRef.current) return;
    isUpdatingLocationRef.current = true;
    try {
      await apiUpdateLocationFull(
        payload.latitude,
        payload.longitude,
        payload.accuracy,
        payload.speed,
        payload.heading,
        payload.captured_at
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workforce:location-updated', {
            detail: { ...newLoc, source: 'session_watcher' },
          })
        );
      }
    } catch (_) {
    } finally {
      isUpdatingLocationRef.current = false;
    }
  }, []);

  const handleLocationError = useCallback((err) => {
    console.warn('[EmployeeRuntime] Location tracker warning:', err);
    setPresenceState((prev) => (prev === 'OFFLINE' ? 'OFFLINE' : 'ONLINE_LOCATION_PENDING'));
    const state = computeGpsState(null, 0, true, err);
    setGpsState(state);
  }, []);

  // Mount single continuous GPS watcher for online authenticated employee
  useLocationTracker(
    Boolean(isAuthenticated && isApprovedEmployee && isOnline),
    handlePositionChange,
    handleLocationError
  );

  const scanCurrentLocation = useCallback(async () => {
    try {
      setGpsState(GPS_STATE.REQUESTING);
      const pos = await getGPSPosition(true);
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      const captured_at = new Date(pos.timestamp || Date.now()).toISOString();
      await apiUpdateLocationFull(latitude, longitude, accuracy, speed, heading, captured_at);
      const newLoc = {
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        timestamp: pos.timestamp || Date.now(),
        captured_at,
      };
      setLiveLocation(newLoc);
      setPresenceState('ONLINE_GPS_LIVE');
      setGpsState(accuracy <= MAX_GEOFENCE_ACCURACY_METERS ? GPS_STATE.GEOFENCE_READY : GPS_STATE.LIVE);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workforce:location-updated', {
            detail: { ...newLoc, source: 'manual_scan' },
          })
        );
      }
      return newLoc;
    } catch (err) {
      const state = computeGpsState(null, 0, true, err);
      setGpsState(state);
      throw err;
    }
  }, []);

  // ── 8. Centralized Automatic Geofence Arrival Monitor (<= 250m) ─────────────
  const inFlightArrivalJobIdsRef = useRef(new Set());

  useEffect(() => {
    if (!isOnline || !liveLocation || !selectedJob) return;
    const st = (selectedJob.status || selectedJob.job_status || '').toLowerCase();
    if (!['accepted', 'on_the_way', 'en_route'].includes(st)) return;

    const custLat = Number(selectedJob.latitude);
    const custLon = Number(selectedJob.longitude);
    if (isNaN(custLat) || isNaN(custLon) || (custLat === 0 && custLon === 0)) return;

    const dist = haversineMetres(liveLocation.latitude, liveLocation.longitude, custLat, custLon);
    const isAccurate = liveLocation.accuracy != null && liveLocation.accuracy <= MAX_GEOFENCE_ACCURACY_METERS;

    if (dist <= 250 && isAccurate && !inFlightArrivalJobIdsRef.current.has(selectedJob.id)) {
      inFlightArrivalJobIdsRef.current.add(selectedJob.id);
      console.info(`[EmployeeRuntime] Auto-Arrival triggered at ${Math.round(dist)}m for Job #${selectedJob.id}.`);
      apiVerifyArrival(
        selectedJob.id,
        liveLocation.latitude,
        liveLocation.longitude,
        liveLocation.accuracy,
        liveLocation.timestamp || Date.now()
      )
        .then(() => {
          scheduleCoalescedRefresh(100);
        })
        .catch((err) => {
          console.warn('[EmployeeRuntime] Auto-arrival API error:', err);
          inFlightArrivalJobIdsRef.current.delete(selectedJob.id);
        });
    }
  }, [isOnline, liveLocation, selectedJob, scheduleCoalescedRefresh]);

  // ── 9. Single Controlled Auto Clock-In Runtime Action ──────────────────────
  const inFlightClockInRef = useRef(null);

  const autoClockIn = useCallback(
    async (jobId, options = {}) => {
      if (inFlightClockInRef.current) {
        return inFlightClockInRef.current;
      }

      const promise = (async () => {
        try {
          const loc = liveLocation || (await scanCurrentLocation());
          const res = await apiClockIn({
            lat: loc.latitude,
            lon: loc.longitude,
            accuracy: loc.accuracy,
            timestamp: loc.timestamp || Date.now(),
            address: options.address || 'GPS Verified Site Arrival',
            job_id: jobId,
          });
          await refreshActiveJobs({ force: true });
          return res;
        } finally {
          inFlightClockInRef.current = null;
        }
      })();

      inFlightClockInRef.current = promise;
      return promise;
    },
    [liveLocation, scanCurrentLocation, refreshActiveJobs]
  );

  // ── 10. Explicit Clock-In Readiness State Engine ───────────────────────────
  const getClockInReadiness = useCallback(
    (job, preServiceStatus = null, isShiftClockedIn = false) => {
      if (isShiftClockedIn) return { state: 'CLOCKED_IN', label: 'Clocked In', canClockIn: false };
      if (!job) return { state: 'NOT_READY', label: 'No Active Job', canClockIn: false };
      if (!isOnline) return { state: 'OFFLINE', label: 'Technician Offline', canClockIn: false };

      if (gpsState === GPS_STATE.PERMISSION_DENIED) {
        return { state: 'GPS_UNAVAILABLE', label: 'Location Permission Denied', canClockIn: false, reason: 'Please allow location access in browser settings.' };
      }
      if (gpsState === GPS_STATE.UNAVAILABLE || gpsState === GPS_STATE.ERROR) {
        return { state: 'GPS_UNAVAILABLE', label: 'GPS Signal Unavailable', canClockIn: false, reason: 'Device GPS unavailable. Please enable location.' };
      }
      if (gpsState === GPS_STATE.ACQUIRING || gpsState === GPS_STATE.REQUESTING) {
        return { state: 'GPS_PENDING', label: 'Acquiring GPS Signal...', canClockIn: false, reason: 'Waiting for high-accuracy GPS fix...' };
      }
      if (gpsState === GPS_STATE.STALE) {
        return { state: 'GPS_STALE', label: 'GPS Signal Stale', canClockIn: false, reason: 'GPS fix is outdated. Waiting for fresh fix...' };
      }

      const custLat = Number(job.latitude);
      const custLon = Number(job.longitude);
      let distanceM = null;
      if (!isNaN(custLat) && !isNaN(custLon) && liveLocation) {
        distanceM = Math.round(haversineMetres(liveLocation.latitude, liveLocation.longitude, custLat, custLon));
      }

      const isGeofencePassed = preServiceStatus?.geofence_passed || (distanceM != null && distanceM <= 250);
      if (!isGeofencePassed) {
        return {
          state: 'OUTSIDE_GEOFENCE',
          label: `Outside Geofence (${distanceM != null ? `${distanceM}m` : 'Unknown'} away)`,
          canClockIn: false,
          distanceM,
          reason: `You are ${distanceM != null ? `${distanceM}m` : 'away'} from customer. Move within 250m.`,
        };
      }

      if (!preServiceStatus?.otp_verified) {
        return { state: 'OTP_PENDING', label: 'Customer OTP Required', canClockIn: false, reason: 'Ask customer for the 6-digit Work Start OTP code.' };
      }

      if (!preServiceStatus?.presence_photo) {
        return { state: 'PRESENCE_PENDING', label: 'Technician Presence Selfie Required', canClockIn: false, reason: 'Take live presence selfie to confirm on-site identity.' };
      }

      return { state: 'READY', label: 'Pre-Verification Complete — Ready', canClockIn: true, distanceM };
    },
    [isOnline, gpsState, liveLocation]
  );

  // ── 11. Realtime Stream (SSE) ──────────────────────────────────────────────
  const handleRealtimeEvent = useCallback(
    (eventData) => {
      const type = eventData.event_type;
      console.info(`[EmployeeRuntime SSE Event] ${type}`, eventData);

      if (type === 'OFFER_CREATED' || type === 'JOB_OFFER' || type === 'EMPLOYEE_JOB_OFFERED') {
        const payload = eventData.payload || {};
        if (payload.offer_id || payload.id) {
          triggerOfferBrowserNotification(payload);
        }
        scheduleCoalescedRefresh(150);
      } else if (
        [
          'JOB_ASSIGNED',
          'EMPLOYEE_JOB_ACCEPTED',
          'ARRIVAL_DETECTED',
          'JOB_COMPLETED',
          'EMPLOYEE_JOB_COMPLETED',
          'EMPLOYEE_JOB_CANCELLED',
          'EMPLOYEE_CANCELLED',
          'EMPLOYEE_AVAILABILITY_CHANGED',
          'PRE_SERVICE_COMPLETED',
          'JOB_LOCATION_UPDATE',
          'STATUS_CHANGE',
          'EXTENSION_DECIDED',
          'PAYMENT_COLLECTED',
          'PAYMENT_OTP_VERIFIED',
        ].includes(type)
      ) {
        scheduleCoalescedRefresh(200);
      } else if (type === 'NOTIFICATION_CREATED') {
        syncNotifications();
      }
    },
    [triggerOfferBrowserNotification, scheduleCoalescedRefresh, syncNotifications]
  );

  const handleRealtimeReconcile = useCallback(() => {
    scheduleCoalescedRefresh(100);
    syncNotifications();
  }, [scheduleCoalescedRefresh, syncNotifications]);

  const handleRealtimeAuthFailure = useCallback(() => {
    logout();
  }, [logout]);

  const { connectionState: realtimeConnectionState } = useRealtimeStream({
    enabled: Boolean(isAuthenticated && isApprovedEmployee && isOnline),
    onEvent: handleRealtimeEvent,
    onReconcile: handleRealtimeReconcile,
    onAuthFailure: handleRealtimeAuthFailure,
  });

  // ── 12. Fast Presence Toggle Controller ────────────────────────────────────
  const togglePresenceFast = useCallback(
    async (desiredState = null) => {
      try {
        setPresenceState('CONNECTING');
        const res = await authTogglePresence(desiredState);
        if (res.is_online) {
          setPresenceState('ONLINE_LOCATION_PENDING');
          setGpsState(GPS_STATE.ACQUIRING);
          // Background GPS resolution without blocking presence completion
          getGPSPosition(false)
            .then((pos) => {
              handlePositionChange({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
                captured_at: new Date(pos.timestamp || Date.now()).toISOString(),
                timestamp: pos.timestamp || Date.now(),
                is_geofence_ready: pos.coords.accuracy <= MAX_GEOFENCE_ACCURACY_METERS,
              });
            })
            .catch(() => {});
          refreshActiveJobs({ silent: true });
        } else {
          setPresenceState('OFFLINE');
          setGpsState(GPS_STATE.IDLE);
        }
        return res;
      } catch (err) {
        setPresenceState(isOnlineAuth ? 'ONLINE_LOCATION_PENDING' : 'OFFLINE');
        throw err;
      }
    },
    [authTogglePresence, isOnlineAuth, handlePositionChange, refreshActiveJobs]
  );

  // ── 13. Context Value Assembly ─────────────────────────────────────────────
  const value = useMemo(
    () => ({
      // Jobs State
      activeJobs,
      completedJobs,
      selectedJob,
      setSelectedJob,
      incomingOffer,
      incomingOffers,
      hasActiveJob,
      isJobsLoading,
      isCompletedLoading,
      jobsError,
      refreshActiveJobs,
      refreshCompletedJobs,
      serverTimeOffset,
      getServerTimeNow: () => Date.now() + (serverTimeOffset || 0),

      // Location & Presence State Machine
      presenceState,
      gpsState,
      isOnline,
      isGpsLive,
      isGpsGeofenceReady,
      isLocationPending,
      dispatchReady: isOnline && isGpsLive,
      liveLocation,
      locationState: isGpsGeofenceReady ? 'ready' : isGpsLive ? 'live' : isLocationPending ? 'locating' : 'idle',
      scanCurrentLocation,
      togglePresence: togglePresenceFast,

      // Auto Clock-In & Readiness
      autoClockIn,
      getClockInReadiness,

      // Notifications
      notifications,
      unreadCount,
      syncNotifications,
      markNotificationAsRead,
      clearAllNotifications,

      // Realtime State
      realtimeConnectionState,
    }),
    [
      activeJobs,
      completedJobs,
      selectedJob,
      incomingOffer,
      incomingOffers,
      hasActiveJob,
      isJobsLoading,
      isCompletedLoading,
      jobsError,
      refreshActiveJobs,
      refreshCompletedJobs,
      presenceState,
      gpsState,
      isOnline,
      isGpsLive,
      isGpsGeofenceReady,
      isLocationPending,
      liveLocation,
      scanCurrentLocation,
      togglePresenceFast,
      autoClockIn,
      getClockInReadiness,
      notifications,
      unreadCount,
      syncNotifications,
      markNotificationAsRead,
      clearAllNotifications,
      realtimeConnectionState,
    ]
  );

  return <EmployeeRuntimeContext.Provider value={value}>{children}</EmployeeRuntimeContext.Provider>;
}
