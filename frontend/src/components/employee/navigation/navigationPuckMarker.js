/**
 * navigationPuckMarker.js
 *
 * Generates the Google-Maps-style Navigation Chevron / Puck Marker.
 * Features:
 *  - High-visibility Electric Blue core with white ring (#1A73E8).
 *  - Forward direction chevron arrow pointing along movement heading.
 *  - Translucent forward-facing illumination beam / radar pulse showing field-of-view.
 *  - Centered anchor point for exact GPS coordinate alignment.
 */

export function createNavigationPuckIcon(heading = 0, size = 64) {
  const normalizedHeading = ((heading % 360) + 360) % 360;

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
      <defs>
        <!-- Forward Radar Beam Gradient -->
        <radialGradient id="beamGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.5"/>
          <stop offset="70%" stop-color="#2563EB" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#1D4ED8" stop-opacity="0"/>
        </radialGradient>

        <!-- Drop Shadow for Core Puck -->
        <filter id="puckShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>

      <!-- Rotatable Group around Center (32, 32) -->
      <g transform="rotate(${normalizedHeading}, 32, 32)">
        <!-- 1. Forward Radar Illumination Fan Arc -->
        <path d="M32 32 L14 4 A32 32 0 0 1 50 4 Z" fill="url(#beamGlow)" />

        <!-- 2. Outer Halo Pulse -->
        <circle cx="32" cy="32" r="22" fill="#3B82F6" fill-opacity="0.22" />

        <!-- 3. White Border Base -->
        <circle cx="32" cy="32" r="14" fill="#FFFFFF" filter="url(#puckShadow)" />

        <!-- 4. Electric Blue Core Dot -->
        <circle cx="32" cy="32" r="10.5" fill="#1A73E8" />

        <!-- 5. Forward White Navigation Chevron Arrow -->
        <path d="M32 25 L37 34 L32 31.5 L27 34 Z" fill="#FFFFFF" />
      </g>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
    scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(size, size) : { width: size, height: size },
    anchor: window.google?.maps?.Point ? new window.google.maps.Point(size / 2, size / 2) : { x: size / 2, y: size / 2 },
  };
}
