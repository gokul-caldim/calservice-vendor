/**
 * Production API Client for Geofenced Clock-In & Time Tracking
 */
import { apiRequest } from './client.js';

export async function apiClockIn(payload) {
  return await apiRequest('/workforce/time-tracking/clock-in/', {
    method: 'POST',
    json: payload,
  });
}

export async function apiClockOut(payload = {}) {
  return await apiRequest('/workforce/time-tracking/clock-out/', {
    method: 'POST',
    json: payload,
  });
}

export async function apiStartBreak(breakType = 'tea') {
  return await apiRequest('/workforce/time-tracking/break/start/', {
    method: 'POST',
    json: { break_type: breakType },
  });
}

export async function apiEndBreak() {
  return await apiRequest('/workforce/time-tracking/break/end/', {
    method: 'POST',
  });
}

export async function apiGeofenceCheck(lat, lon) {
  return await apiRequest('/workforce/time-tracking/geofence/check/', {
    method: 'POST',
    json: { lat, lon },
  });
}

export async function apiGetTimeTracking() {
  return await apiRequest('/workforce/time-tracking/');
}

export async function apiGetTimeLogs() {
  return await apiRequest('/workforce/time-tracking/logs/');
}

export async function apiGetLocations() {
  return await apiRequest('/workforce/time-tracking/locations/');
}

export async function apiCreateLocation(payload) {
  return await apiRequest('/workforce/time-tracking/locations/', {
    method: 'POST',
    json: payload,
  });
}
