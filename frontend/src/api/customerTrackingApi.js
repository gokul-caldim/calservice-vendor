/**
 * customerTrackingApi.js
 *
 * Dedicated API client for customer-facing live technician tracking.
 * Uses existing authenticated apiRequest client.
 */

import { apiRequest } from './client.js';

/**
 * Fetch live technician location, ETA, customer destination, and status for a specific booking.
 * @param {string|number} jobId - ServiceRequest primary key
 */
export async function apiGetJobLiveTracking(jobId) {
  return await apiRequest(`/workforce/jobs/${jobId}/live-tracking/`);
}
