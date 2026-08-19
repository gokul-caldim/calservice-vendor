/**
 * useGPSPosition.js
 *
 * Ported and adapted from location_service_share/frontend/useLocation.js.
 * Provides a low-level GPS position getter and a higher-level tracking hook.
 *
 * Architecture:
 *   Employee device → Browser Geolocation API
 *     → real GPS coordinates (no mocks, no hardcoded values)
 *     → onPositionChange callback (used to push to /workforce/presence/location/)
 *
 * Rules enforced:
 *  - Only real browser GPS is used. No manual override of live coordinates.
 *  - Respects 5-minute update interval + 10m movement threshold to avoid flooding.
 *  - Cleans up on unmount: clears watchers and intervals.
 *  - Circuit breaker: Stops GPS transmissions immediately if auth token is missing/expired to prevent 401 spam.
 *  - Enforces EXACTLY ONE continuous watcher invariant.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '../utils/authTokens.js';

// Minimum distance (metres) that must be exceeded before a new position is reported
const MOVEMENT_THRESHOLD_METRES = 10;
// Maximum age of a cached position to accept (milliseconds)
const MAX_POSITION_AGE_MS = 30_000; // 30 seconds
// Interval between automatic periodic telemetry heartbeats (ms)
const POLL_INTERVAL_MS = 25_000; // 25 seconds automatic background heartbeat

/**
 * Haversine distance in metres between two lat/lng points.
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns a Promise that resolves with the current GeolocationPosition, or
 * rejects with a structured error object.
 */
export function getGPSPosition(preferHighAccuracy = true) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    const tryPosition = (enableHighAccuracy, timeoutMs, maxAgeMs, isFallback = false) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => {
          if (!isFallback && (err.code === 3 || err.code === 2 || err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE)) {
            tryPosition(false, 10000, 300000, true);
            return;
          }

          const codes = { 1: 'PERMISSION_DENIED', 2: 'POSITION_UNAVAILABLE', 3: 'TIMEOUT' };
          let msg = err.message || 'Could not retrieve GPS position.';
          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            msg = 'Location permission is denied. Please allow location access in your browser address bar settings.';
          } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Location is unavailable. Please check your device location services and internet connection.';
          } else if (err.code === 3 || err.code === err.TIMEOUT) {
            msg = 'Location request timed out. Please check your connection and try again.';
          }

          reject({
            code: codes[err.code] || 'POSITION_UNAVAILABLE',
            message: msg,
            originalError: err,
          });
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: maxAgeMs,
        }
      );
    };

    tryPosition(preferHighAccuracy, 6000, MAX_POSITION_AGE_MS, !preferHighAccuracy);
  });
}

/**
 * useGPSPosition hook for one-shot coordinate resolution.
 */
export function useGPSPosition() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getGPSPosition();
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, error, loading, refresh };
}

/**
 * Location Adapter Abstraction (Mobile & Web Architecture)
 */
export class WebGeolocationAdapter {
  watch(onSuccess, onError, options) {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (onError) onError({ code: 'UNSUPPORTED', message: 'Geolocation not supported.' });
      return null;
    }
    return navigator.geolocation.watchPosition(
      onSuccess,
      (err) => {
        if (options?.enableHighAccuracy && (err.code === 2 || err.code === 3)) {
          try {
            navigator.geolocation.clearWatch(this._watchId);
          } catch (_) {}
          this._watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 60000,
          });
          return;
        }
        if (onError) onError(err);
      },
      options
    );
  }

  clearWatch(id) {
    if (typeof window !== 'undefined' && navigator.geolocation && id != null) {
      try {
        navigator.geolocation.clearWatch(id);
      } catch (_) {}
    }
  }

  getCurrentPosition(onSuccess, onError, options) {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (onError) onError({ code: 'UNSUPPORTED', message: 'Geolocation not supported.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (options?.enableHighAccuracy && (err.code === 2 || err.code === 3)) {
          navigator.geolocation.getCurrentPosition(onSuccess, onError, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          });
          return;
        }
        if (onError) onError(err);
      },
      options
    );
  }
}

const defaultLocationAdapter = new WebGeolocationAdapter();

/**
 * useLocationTracker hook.
 *
 * Single centralized continuous GPS watcher for employee session.
 * Starts live GPS tracking automatically when `active` is true (e.g. employee is ONLINE & authenticated).
 * Incorporates an authentication circuit breaker so unauthenticated or expired states do NOT spam location requests.
 */
export function useLocationTracker(active, onPositionChange, onError, adapter = defaultLocationAdapter) {
  const lastPositionRef = useRef(null);
  const lastReportedTimeRef = useRef(0);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const isAuthValidRef = useRef(true);

  const flushOfflineQueue = useCallback(() => {
    if (offlineQueueRef.current.length === 0) return;
    console.info(`[GPS_OFFLINE_RECOVERY] Flushing ${offlineQueueRef.current.length} queued telemetry fixes.`);
    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    queue.forEach((payload) => {
      onPositionChange(payload);
    });
  }, [onPositionChange]);

  const handlePosition = useCallback(
    (pos) => {
      // Circuit breaker: check token presence
      const token = getAccessToken();
      if (!token) {
        isAuthValidRef.current = false;
        return;
      }

      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      const now = Date.now();
      const last = lastPositionRef.current;
      const timeSinceLastReport = now - lastReportedTimeRef.current;

      // Skip if movement is below threshold AND we reported recently
      if (last && timeSinceLastReport < POLL_INTERVAL_MS) {
        const dist = haversineMetres(last.latitude, last.longitude, latitude, longitude);
        if (dist < MOVEMENT_THRESHOLD_METRES) return;
      }

      lastPositionRef.current = { latitude, longitude };
      lastReportedTimeRef.current = now;

      const payload = {
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        captured_at: new Date(pos.timestamp || now).toISOString(),
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Enqueue if offline (capped at 50 points to prevent memory leak)
        if (offlineQueueRef.current.length >= 50) offlineQueueRef.current.shift();
        offlineQueueRef.current.push(payload);
        return;
      }

      onPositionChange(payload);
    },
    [onPositionChange],
  );

  const handleError = useCallback(
    (err) => {
      const codes = { 1: 'PERMISSION_DENIED', 2: 'POSITION_UNAVAILABLE', 3: 'TIMEOUT' };
      let msg = err.message || 'Could not retrieve GPS position.';
      if (err.code === 1 || err.code === 'PERMISSION_DENIED') {
        msg = 'Location permission is required to receive nearby jobs.';
      } else if (err.code === 2 || err.code === 'POSITION_UNAVAILABLE') {
        msg = 'Location services are unavailable. Please check device location settings.';
      } else if (err.code === 3 || err.code === 'TIMEOUT') {
        msg = 'Location request timed out. Retrying in background...';
      }
      if (onError) {
        onError({ code: codes[err.code] || err.code || 'POSITION_UNAVAILABLE', message: msg });
      }
    },
    [onError],
  );

  // Force-poll on interval in case watcher is idle
  const forcePoll = useCallback(() => {
    if (!getAccessToken()) return;
    adapter.getCurrentPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: MAX_POSITION_AGE_MS,
    });
  }, [handlePosition, handleError, adapter]);

  useEffect(() => {
    const handleOnline = () => {
      flushOfflineQueue();
      forcePoll();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [flushOfflineQueue, forcePoll]);

  useEffect(() => {
    if (!active) {
      // Stop tracking when offline/inactive
      if (watchIdRef.current !== null) {
        adapter.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastPositionRef.current = null;
      lastReportedTimeRef.current = 0;
      return;
    }

    // Start single continuous watch when active and authenticated
    watchIdRef.current = adapter.watch(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: MAX_POSITION_AGE_MS,
    });

    // Periodic force-poll as backup
    intervalRef.current = setInterval(forcePoll, POLL_INTERVAL_MS);

    // Initial fix immediately upon becoming active
    forcePoll();

    return () => {
      if (watchIdRef.current !== null) {
        adapter.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, handlePosition, handleError, forcePoll, adapter]);
}
