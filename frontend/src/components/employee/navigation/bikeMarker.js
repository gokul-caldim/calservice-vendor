/**
 * bikeMarker.js
 *
 * Professional Service Motorcycle / Bike Marker for CalTrack Technician Navigation.
 *
 * Features:
 *  - Custom SVG Field Service Motorcycle with helmet rider and service box.
 *  - Crisp transparent background with subtle glowing radar pulse halo.
 *  - Smooth 360-degree rotation support oriented to movement heading (0° = North).
 *  - High visual contrast and clarity across all Google Map zoom levels.
 *  - Center-anchored for accurate GPS coordinate alignment.
 */

/**
 * Generates an SVG Data URI for the technician motorcycle marker with the specified heading rotation.
 * @param {number} heading - Bearing angle in degrees (0 to 360, 0 = North).
 * @param {string} accentColor - Primary badge/vehicle color (default: #2563EB electric blue).
 * @returns {string} SVG Data URI
 */
export function getBikeMarkerSvgDataUri(heading = 0, accentColor = '#2563EB') {
  const normalizedHeading = ((heading % 360) + 360) % 360;

  // The base SVG icon is drawn facing UP (North = 0°).
  // Rotation is applied around the center (cx=32, cy=32).
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <!-- Soft Drop Shadow for high visibility on road maps -->
        <filter id="bikeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#0F172A" flood-opacity="0.5"/>
        </filter>
        <!-- Subtle pulsing radar glow -->
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.35"/>
          <stop offset="60%" stop-color="${accentColor}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- 1. Outer Radar Pulse Halo -->
      <circle cx="32" cy="32" r="30" fill="url(#radarGlow)"/>

      <!-- 2. Rotatable Vehicle Container -->
      <g transform="rotate(${normalizedHeading.toFixed(1)}, 32, 32)">
        <!-- Outer White Glow Ring -->
        <circle cx="32" cy="32" r="23" fill="#FFFFFF" filter="url(#bikeShadow)"/>

        <!-- Primary Colored Badge Base -->
        <circle cx="32" cy="32" r="20" fill="${accentColor}" stroke="#FFFFFF" stroke-width="2.5"/>

        <!-- Forward Heading Pointer Arrow (North indicator) -->
        <polygon points="32,9 37,17 27,17" fill="#FFFFFF" opacity="0.95"/>

        <!-- Field Service Motorcycle / Bike Top-Down Silhouette -->
        <!-- Front Wheel -->
        <rect x="30" y="14" width="4" height="8" rx="2" fill="#0F172A" stroke="#FFFFFF" stroke-width="1"/>
        
        <!-- Handlebars & Mirrors -->
        <path d="M22 22 Q32 20 42 22" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <circle cx="21" cy="22" r="1.5" fill="#FFFFFF"/>
        <circle cx="43" cy="22" r="1.5" fill="#FFFFFF"/>

        <!-- Motorcycle Body Frame -->
        <path d="M28 22 L36 22 L35 38 L29 38 Z" fill="#0F172A"/>

        <!-- Rider Helmet (with visor facing forward) -->
        <circle cx="32" cy="28" r="5" fill="#FFFFFF"/>
        <path d="M29 26 Q32 24 35 26" stroke="#0F172A" stroke-width="2" stroke-linecap="round" fill="none"/>

        <!-- Technician Field Service Toolkit / Box (Rear) -->
        <rect x="26" y="36" width="12" height="9" rx="1.5" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.2"/>
        <line x1="32" y1="36" x2="32" y2="45" stroke="#0F172A" stroke-width="1"/>

        <!-- Rear Wheel -->
        <rect x="30" y="44" width="4" height="7" rx="2" fill="#0F172A" stroke="#FFFFFF" stroke-width="1"/>
      </g>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
}

/**
 * Creates a Google Maps Icon object configured for the technician bike marker.
 * @param {number} heading - Bearing angle in degrees (0 to 360).
 * @param {number} size - Pixel size (default: 56).
 * @param {string} accentColor - Color hex.
 * @returns {google.maps.Icon}
 */
export function createBikeMarkerIcon(heading = 0, size = 56, accentColor = '#2563EB') {
  if (!window.google?.maps) return null;
  const google = window.google;

  return {
    url: getBikeMarkerSvgDataUri(heading, accentColor),
    scaledSize: new google.maps.Size(size, size),
    size: new google.maps.Size(size, size),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(size / 2, size / 2), // Center anchored
  };
}
