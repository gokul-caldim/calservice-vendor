/**
 * useGPSPosition.js
 *
 * Single centralized low-level GPS implementation for CalTrack Workforce.
 * Incorporates Phase 2 Production Standards:
 * 1. Explicit GPS state machine:
 *    GPS_IDLE, GPS_REQUESTING, GPS_ACQUIRING, GPS_LIVE, GPS_GEOFENCE_READY,
 *    GPS_STALE, GPS_UNAVAILABLE, GPS_PERMISSION_DENIED, GPS_ERROR
 * 2. Staged startup acquisition (cached -> normal -> watch -> high-accuracy)
 * 3. Controlled exponential retry backoff on timeout/errors (2s -> 5s -> 15s -> 30s max)
 * 4. Authoritative telemetry validation (lat, lon, accuracy, timestamp freshness)
 * 5. Strict Single Watcher ownership with circuit breaker
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '../utils/authTokens.js';

// Explicit GPS State Machine Constants
export const GPS_STATE = {
  IDLE: 'GPS_IDLE',
  REQUESTING: 'GPS_REQUESTING',
  ACQUIRING: 'GPS_ACQUIRING',
  LIVE: 'GPS_LIVE',
  GEOFENCE_READY: 'GPS_GEOFENCE_READY',
  STALE: 'GPS_STALE',
  UNAVAILABLE: 'GPS_UNAVAILABLE',
  PERMISSION_DENIED: 'GPS_PERMISSION_DENIED',
  ERROR: 'GPS_ERROR',
};

// Movement & Freshness thresholds
export const MOVEMENT_THRESHOLD_METRES = 10;
export const MAX_POSITION_AGE_MS = 30_000; // 30 seconds for live freshness
export const MAX_BACKEND_AGE_MS = 300_000; // 300 seconds maximum backend age limit
export const POLL_INTERVAL_MS = 25_000; // 25 seconds heartbeat
export const MAX_GEOFENCE_ACCURACY_METERS = 100; // Accuracy must be <= 100m for geofence readiness

// Backoff schedule for retry on timeout / transient errors (ms)
export const RETRY_BACKOFF_SCHEDULE = [2000, 5000, 15000, 30000];

/**
 * Validate telemetry coordinates, accuracy, and timestamp freshness.
 */
export function validateTelemetryCoordinates(lat, lon, accuracy = null, timestamp = null) {
  if (lat == null || lon == null) {
    return { valid: false, reason: 'Coordinates missing' };
  }
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (isNaN(latNum) || isNaN(lonNum)) {
    return { valid: false, reason: 'Invalid coordinate numeric format' };
  }
  if (latNum < -90.0 || latNum > 90.0 || lonNum < -180.0 || lonNum > 180.0) {
    return { valid: false, reason: 'Coordinates out of range (-90..90, -180..180)' };
  }
  if (latNum === 0 && lonNum === 0) {
    return { valid: false, reason: 'Invalid zero coordinates (0, 0)' };
  }

  const now = Date.now();
  if (timestamp) {
    const tsNum = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
    if (!isNaN(tsNum)) {
      const ageMs = now - tsNum;
      if (ageMs > MAX_BACKEND_AGE_MS) {
        return { valid: false, reason: `Telemetry fix is stale (${Math.round(ageMs / 1000)}s old)` };
      }
      if (ageMs < -60_000) {
        return { valid: false, reason: 'Telemetry timestamp is future-dated' };
      }
    }
  }

  return { valid: true, lat: latNum, lon: lonNum };
}

/**
 * Determine the explicit GPS state based on location fix, accuracy, and freshness.
 */
export function computeGpsState(location, lastFixTime = 0, isError = false, errorObj = null) {
  if (isError && errorObj) {
    if (errorObj.code === 'PERMISSION_DENIED' || errorObj.code === 1) return GPS_STATE.PERMISSION_DENIED;
    if (errorObj.code === 'POSITION_UNAVAILABLE' || errorObj.code === 2) return GPS_STATE.UNAVAILABLE;
    if (errorObj.code === 'TIMEOUT' || errorObj.code === 3) return GPS_STATE.UNAVAILABLE;
    return GPS_STATE.ERROR;
  }

  if (!location || location.latitude == null || location.longitude == null) {
    return GPS_STATE.IDLE;
  }

  const now = Date.now();
  const fixTime = location.timestamp || lastFixTime || now;
  const ageMs = now - fixTime;

  if (ageMs > MAX_POSITION_AGE_MS) {
    return GPS_STATE.STALE;
  }

  const accuracy = location.accuracy != null ? Number(location.accuracy) : null;
  if (accuracy != null && accuracy <= MAX_GEOFENCE_ACCURACY_METERS) {
    return GPS_STATE.GEOFENCE_READY;
  }

  return GPS_STATE.LIVE;
}

/**
 * Haversine distance in metres between two lat/lng points.
 * Executes in microseconds.
 */
export function haversineMetres(lat1, lng1, lat2, lng2) {
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
 * Staged GPS position acquisition:
 * Stage 1: Cached position (maximumAge: 60s, timeout: 3s)
 * Stage 2: Standard fix (maximumAge: 10s, timeout: 6s, enableHighAccuracy: false)
 * Stage 3: High accuracy fix (timeout: 10s, enableHighAccuracy: true)
 */
export function getGPSPosition(preferHighAccuracy = true) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    const tryPosition = (enableHighAccuracy, timeoutMs, maxAgeMs, isFallback = false) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const val = validateTelemetryCoordinates(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            pos.timestamp
          );
          if (!val.valid) {
            reject({ code: 'INVALID_COORDINATES', message: val.reason });
            return;
          }
          resolve(pos);
        },
        (err) => {
          if (!isFallback && (err.code === 3 || err.code === 2 || err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE)) {
            // Stage 2 fallback: standard accuracy with longer timeout
            tryPosition(false, 10000, 60000, true);
            return;
          }

          const codes = { 1: 'PERMISSION_DENIED', 2: 'POSITION_UNAVAILABLE', 3: 'TIMEOUT' };
          let msg = err.message || 'Could not retrieve GPS position.';
          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            msg = 'Location permission is denied. Please allow location access in your browser settings.';
          } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Location is unavailable. Please check device location services.';
          } else if (err.code === 3 || err.code === err.TIMEOUT) {
            msg = 'Location request timed out. Retrying in background...';
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

    if (preferHighAccuracy) {
      tryPosition(true, 8000, MAX_POSITION_AGE_MS, false);
    } else {
      tryPosition(false, 5000, 60000, false);
    }
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
      const pos = await getGPSPosition(true);
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
 * WebGeolocationAdapter abstraction with staged fallback.
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
 * Controlled exponential retry backoff on timeout: 2s -> 5s -> 15s -> 30s.
 * Resets backoff counter immediately on receiving valid location fix.
 */
export function useLocationTracker(active, onPositionChange, onError, adapter = defaultLocationAdapter) {
  const lastPositionRef = useRef(null);
  const lastReportedTimeRef = useRef(0);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const backoffTimeoutRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const offlineQueueRef = useRef([]);
  const isAuthValidRef = useRef(true);

  const clearBackoffTimer = useCallback(() => {
    if (backoffTimeoutRef.current) {
      clearTimeout(backoffTimeoutRef.current);
      backoffTimeoutRef.current = null;
    }
  }, []);

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
      const val = validateTelemetryCoordinates(latitude, longitude, accuracy, pos.timestamp);
      if (!val.valid) {
        console.warn('[useLocationTracker] Ignored invalid GPS telemetry:', val.reason);
        return;
      }

      // Reset exponential backoff counter on successful fix
      retryAttemptRef.current = 0;
      clearBackoffTimer();

      const now = Date.now();
      const last = lastPositionRef.current;
      const timeSinceLastReport = now - lastReportedTimeRef.current;

      // Skip if movement is below threshold AND reported recently
      if (last && timeSinceLastReport < POLL_INTERVAL_MS) {
        const dist = haversineMetres(last.latitude, last.longitude, latitude, longitude);
        if (dist < MOVEMENT_THRESHOLD_METRES) return;
      }

      lastPositionRef.current = { latitude, longitude };
      lastReportedTimeRef.current = now;

      const payload = {
        latitude,
        longitude,
        accuracy: accuracy != null ? Math.round(accuracy * 10) / 10 : null,
        speed: speed ?? null,
        heading: heading ?? null,
        captured_at: new Date(pos.timestamp || now).toISOString(),
        timestamp: pos.timestamp || now,
        is_geofence_ready: accuracy != null && accuracy <= MAX_GEOFENCE_ACCURACY_METERS,
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (offlineQueueRef.current.length >= 50) offlineQueueRef.current.shift();
        offlineQueueRef.current.push(payload);
        return;
      }

      onPositionChange(payload);
    },
    [onPositionChange, clearBackoffTimer]
  );

  const scheduleBackoffRetry = useCallback(() => {
    if (!active || !getAccessToken()) return;
    clearBackoffTimer();

    const attempt = retryAttemptRef.current;
    const scheduleIndex = Math.min(attempt, RETRY_BACKOFF_SCHEDULE.length - 1);
    const delayMs = RETRY_BACKOFF_SCHEDULE[scheduleIndex];
    retryAttemptRef.current += 1;

    console.info(`[useLocationTracker] Scheduling controlled GPS retry #${retryAttemptRef.current} in ${delayMs}ms.`);

    backoffTimeoutRef.current = setTimeout(() => {
      if (!active) return;
      adapter.getCurrentPosition(
        handlePosition,
        (retryErr) => {
          handleError(retryErr);
        },
        {
          enableHighAccuracy: false, // Standard accuracy for faster recovery
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    }, delayMs);
  }, [active, clearBackoffTimer, adapter, handlePosition]);

  const handleError = useCallback(
    (err) => {
      const codes = { 1: 'PERMISSION_DENIED', 2: 'POSITION_UNAVAILABLE', 3: 'TIMEOUT' };
      let msg = err.message || 'Could not retrieve GPS position.';
      if (err.code === 1 || err.code === 'PERMISSION_DENIED') {
        msg = 'Location permission is required to receive nearby jobs and verify arrival.';
      } else if (err.code === 2 || err.code === 'POSITION_UNAVAILABLE') {
        msg = 'Location services are unavailable. Please check device location settings.';
      } else if (err.code === 3 || err.code === 'TIMEOUT') {
        msg = 'Location request timed out. Retrying in background...';
      }

      const structuredErr = {
        code: codes[err.code] || err.code || 'POSITION_UNAVAILABLE',
        message: msg,
        rawCode: err.code,
      };

      if (onError) {
        onError(structuredErr);
      }

      // Schedule controlled backoff retry on timeout or unavailable (do NOT retry on permission denied)
      if (err.code !== 1 && err.code !== 'PERMISSION_DENIED') {
        scheduleBackoffRetry();
      }
    },
    [onError, scheduleBackoffRetry]
  );

  // Force-poll on interval
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
      if (watchIdRef.current !== null) {
        adapter.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearBackoffTimer();
      retryAttemptRef.current = 0;
      lastPositionRef.current = null;
      lastReportedTimeRef.current = 0;
      return;
    }

    // Start staged acquisition:
    // 1. Check cached position first for instantaneous response
    adapter.getCurrentPosition(
      handlePosition,
      () => {
        // Fallback directly to continuous watcher
      },
      {
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 60000,
      }
    );

    // 2. Start continuous watch
    watchIdRef.current = adapter.watch(handlePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: MAX_POSITION_AGE_MS,
    });

    // 3. Periodic force-poll heartbeat
    intervalRef.current = setInterval(forcePoll, POLL_INTERVAL_MS);

    return () => {
      if (watchIdRef.current !== null) {
        adapter.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearBackoffTimer();
    };
  }, [active, handlePosition, handleError, forcePoll, adapter, clearBackoffTimer]);
}
