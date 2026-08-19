/**
 * navigationUtils.js
 *
 * Precise Geospatial & Mathematical Utilities for CalTrack Technician Navigation.
 *
 * Features:
 *  - High-precision Haversine distance.
 *  - True initial bearing (forward azimuth) calculation.
 *  - Linear & shortest-arc angular interpolation for 60fps animation.
 *  - Cross-track perpendicular distance calculation for off-route detection.
 *  - Truthful distance, ETA, and arrival clock formatters.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the Haversine direct distance in meters between two lat/lon coordinates.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Computes the forward azimuth bearing (in degrees 0°–360°) from point A to point B.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return bearing;
}

/**
 * Linear interpolation (lerp) between two coordinates.
 * @param {{lat: number, lng: number}} fromPos
 * @param {{lat: number, lng: number}} toPos
 * @param {number} t - Fraction between 0 and 1
 * @returns {{lat: number, lng: number}}
 */
export function interpolatePosition(fromPos, toPos, t) {
  if (!fromPos) return toPos;
  if (!toPos) return fromPos;
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    lat: fromPos.lat + (toPos.lat - fromPos.lat) * clampedT,
    lng: fromPos.lng + (toPos.lng - fromPos.lng) * clampedT,
  };
}

/**
 * Interpolates smoothly between two angles (degrees) along the shortest arc.
 * Prevents 360° flip artifacts when crossing North (0° / 360°).
 */
export function interpolateAngle(fromAngle = 0, toAngle = 0, t = 1) {
  const clampedT = Math.max(0, Math.min(1, t));
  const diff = ((toAngle - fromAngle + 180) % 360) - 180;
  const shortestDiff = diff < -180 ? diff + 360 : diff;
  return ((fromAngle + shortestDiff * clampedT + 360) % 360);
}

/**
 * Computes the perpendicular cross-track distance (in meters) from a point to a great-circle segment.
 * Used for detecting when the technician has deviated from the active road route.
 */
export function computeCrossTrackDistanceMeters(point, lineStart, lineEnd) {
  if (!point || !lineStart || !lineEnd) return 0;
  const distStartPoint = calculateDistanceMeters(lineStart.lat, lineStart.lng, point.lat, point.lng);
  if (distStartPoint == null || distStartPoint === 0) return 0;

  const bearingStartPoint = calculateBearing(lineStart.lat, lineStart.lng, point.lat, point.lng);
  const bearingStartEnd = calculateBearing(lineStart.lat, lineStart.lng, lineEnd.lat, lineEnd.lng);

  const deltaBearingRad = ((bearingStartPoint - bearingStartEnd) * Math.PI) / 180;
  const d13 = distStartPoint / EARTH_RADIUS_METERS;

  const crossTrackDistRad = Math.asin(Math.sin(d13) * Math.sin(deltaBearingRad));
  return Math.abs(Math.round(crossTrackDistRad * EARTH_RADIUS_METERS));
}

/**
 * Formats a distance in meters into human-readable navigation text.
 * < 1000m -> "120 m"
 * >= 1000m -> "2.4 km"
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '--';
  const m = Math.round(meters);
  if (m < 50) return 'Arriving now';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Formats a duration in seconds into human-readable navigation ETA.
 */
export function formatEtaMinutes(seconds) {
  if (seconds == null || isNaN(seconds)) return '--';
  const totalMin = Math.round(seconds / 60);
  if (totalMin <= 0) return 'Arriving now';
  if (totalMin === 1) return '1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hrs} hr ${mins} min`;
}

/**
 * Computes an arrival clock string (e.g. "5:08 PM") based on remaining seconds.
 */
export function computeArrivalTimeClock(seconds) {
  if (seconds == null || isNaN(seconds)) return null;
  const arrivalDate = new Date(Date.now() + Math.max(0, seconds) * 1000);
  return arrivalDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}
