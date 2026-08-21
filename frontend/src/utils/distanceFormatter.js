/**
 * frontend/src/utils/distanceFormatter.js
 * 
 * Standardized cosmetic distance display formatter for CalTrack Workforce.
 * 
 * Display Rules:
 *   - For < 1 km: Returns meters formatted as "231.3 m", "578 m", "999 m".
 *   - For normal distances (1.00 km to 9.99 km): Returns 2 decimal places e.g. "1.20 km", "1.70 km", "2.45 km", "8.01 km".
 *   - For larger distances (>= 10.0 km): Returns 1 decimal place e.g. "12.0 km", "13.0 km", "14.0 km", "20.0 km", "20.5 km", "22.0 km".
 * 
 * Note: The formatted output is purely cosmetic for UI display and is NEVER used for business dispatch decisions.
 */

export function formatDistanceDisplay(distanceKm) {
  if (distanceKm == null || isNaN(distanceKm) || distanceKm < 0) {
    return '--';
  }

  const d = Number(distanceKm);

  // < 1 km: Display in meters
  if (d < 1.0) {
    const meters = d * 1000.0;
    // If it has a non-zero decimal part (e.g. 231.3), show 1 decimal; otherwise integer
    if (Math.abs(meters - Math.round(meters)) > 0.05) {
      return `${meters.toFixed(1)} m`;
    }
    return `${Math.round(meters)} m`;
  }

  // 1.0 km to < 10.0 km: Normal distance -> 2 decimal places
  if (d < 10.0) {
    return `${d.toFixed(2)} km`;
  }

  // >= 10.0 km: Larger distance -> 1 decimal place
  return `${d.toFixed(1)} km`;
}

export default formatDistanceDisplay;
