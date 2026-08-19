/**
 * speedAndCompassUtils.js
 *
 * Utilities for real device speed conversion, magnetic compass needle orientation,
 * and shortest-path angular interpolation.
 */

/**
 * Converts real device speed from m/s (browser Geolocation Coordinates.speed) to integer km/h.
 * @param {number|null} speedMps - Speed in meters per second
 * @returns {{ value: number, text: string, unit: string, isAvailable: boolean }}
 */
export function formatSpeedKmh(speedMps) {
  if (speedMps == null || isNaN(speedMps) || speedMps < 0) {
    return {
      value: 0,
      text: '0',
      unit: 'km/h',
      isAvailable: false,
    };
  }
  const kmh = Math.round(speedMps * 3.6);
  return {
    value: kmh,
    text: String(kmh),
    unit: 'km/h',
    isAvailable: true,
  };
}

/**
 * Calculates the counter-rotation angle for the North-pointing magnetic needle.
 * If the map is rotated to heading `mapHeading`, the needle must rotate `-mapHeading`
 * so it continues pointing towards true North.
 * @param {number} mapHeading - Current map heading in degrees (0 - 360)
 * @returns {number} Needle rotation in degrees
 */
export function calculateCompassRotation(mapHeading) {
  if (mapHeading == null || isNaN(mapHeading)) return 0;
  return (-mapHeading + 360) % 360;
}

/**
 * Shortest-path angular interpolation across the 360/0 degree boundary.
 * Prevents 350° -> 10° from spinning backwards through 180°.
 * @param {number} fromAngle - Starting angle in degrees
 * @param {number} toAngle - Target angle in degrees
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {number} Interpolated angle in degrees
 */
export function interpolateShortestAngle(fromAngle, toAngle, t) {
  const diff = ((toAngle - fromAngle + 180) % 360) - 180;
  const shortestDiff = diff < -180 ? diff + 360 : diff;
  return (fromAngle + shortestDiff * t + 360) % 360;
}
