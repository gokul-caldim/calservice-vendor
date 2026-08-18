/**
 * CustomerTrackingMap.jsx
 *
 * Dedicated customer-facing live tracking map for CalServices.
 * Displays:
 *  - Technician live moving location marker (Electric Blue Vehicle with pulse indicator)
 *  - Customer Service Location marker (Vivid Red Home Pin)
 *  - Real road route via Google Maps Directions API
 *  - Customer-friendly Map Controls (Recenter / Fit Route, Focus Location)
 *  - Customer-relevant legend
 *
 * Excludes all workforce operational controls (NO geofence circles, NO GPS diagnostics, NO workforce labels).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  Compass,
  AlertCircle,
  Car,
} from 'lucide-react';
import { loadMapsApi } from '../../utils/loadGoogleMaps.js';

// Calculate direct Haversine distance in meters for route calculation checks
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function CustomerTrackingMap({
  technicianCoords,
  serviceLocation,
  technicianInfo,
  jobStatus,
  onEtaCalculated,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const techMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const infoWindowRef = useRef(null);

  const lastDirectionsTimeRef = useRef(0);
  const lastRoutedCoordsRef = useRef({ lat: null, lng: null });
  const animFrameRef = useRef(null);
  const currentPosRef = useRef({ lat: null, lng: null });

  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [directionsFailed, setDirectionsFailed] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  const destLat = serviceLocation?.latitude != null ? parseFloat(serviceLocation.latitude) : null;
  const destLon = serviceLocation?.longitude != null ? parseFloat(serviceLocation.longitude) : null;
  const techLat = technicianCoords?.latitude != null ? parseFloat(technicianCoords.latitude) : null;
  const techLon = technicianCoords?.longitude != null ? parseFloat(technicianCoords.longitude) : null;

  // Load Google Maps API
  useEffect(() => {
    if (!apiKey) {
      setApiError('Google Maps API key is not configured.');
      return;
    }
    loadMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch((err) => {
        console.warn('Google Maps load warning:', err);
        setApiError('Could not load Google Maps.');
      });
  }, [apiKey]);

  // Smooth animation for technician marker
  const animateVehicleMarker = useCallback((targetLat, targetLng) => {
    if (!techMarkerRef.current || !window.google?.maps) return;

    if (currentPosRef.current.lat == null || currentPosRef.current.lng == null) {
      currentPosRef.current = { lat: targetLat, lng: targetLng };
      techMarkerRef.current.setPosition(new window.google.maps.LatLng(targetLat, targetLng));
      return;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startLat = currentPosRef.current.lat;
    const startLng = currentPosRef.current.lng;
    const duration = 800; // ms
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      const curLat = startLat + (targetLat - startLat) * ease;
      const curLng = startLng + (targetLng - startLng) * ease;
      currentPosRef.current = { lat: curLat, lng: curLng };

      if (techMarkerRef.current && window.google?.maps) {
        techMarkerRef.current.setPosition(new window.google.maps.LatLng(curLat, curLng));
      }

      if (progress < 1.0) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        currentPosRef.current = { lat: targetLat, lng: targetLng };
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  // Update Road Directions
  const updateRoadRoute = useCallback((originLat, originLng, destinationLat, destinationLng, force = false) => {
    if (!window.google?.maps || !directionsServiceRef.current || !directionsRendererRef.current) return;

    const now = Date.now();
    if (!force && now - lastDirectionsTimeRef.current < 4000) return;

    if (!force && lastRoutedCoordsRef.current.lat != null && lastRoutedCoordsRef.current.lng != null) {
      const movedDist = calculateDistanceMeters(
        originLat,
        originLng,
        lastRoutedCoordsRef.current.lat,
        lastRoutedCoordsRef.current.lng
      );
      if (movedDist != null && movedDist < 25 && now - lastDirectionsTimeRef.current < 30000) {
        return;
      }
    }

    lastDirectionsTimeRef.current = now;
    lastRoutedCoordsRef.current = { lat: originLat, lng: originLng };

    const origin = new window.google.maps.LatLng(originLat, originLng);
    const dest = new window.google.maps.LatLng(destinationLat, destinationLng);

    directionsServiceRef.current.route(
      {
        origin,
        destination: dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
        avoidTolls: false,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current.setDirections(result);
          setDirectionsFailed(false);
          const route = result.routes[0]?.legs[0];
          if (route && onEtaCalculated) {
            onEtaCalculated({
              etaText: route.duration?.text || null,
              distanceText: route.distance?.text || null,
            });
          }
        } else {
          setDirectionsFailed(true);
          if (onEtaCalculated) {
            onEtaCalculated({
              etaText: null,
              distanceText: null,
            });
          }
        }
      }
    );
  }, [onEtaCalculated]);

  // Update Technician Marker & Route on new coords
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const google = window.google;

    if (techLat != null && techLon != null) {
      const techPos = new google.maps.LatLng(techLat, techLon);

      if (!techMarkerRef.current) {
        const technicianVehicleSvg = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">
              <defs>
                <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1E3A8A" flood-opacity="0.45"/>
                </filter>
              </defs>
              <circle cx="27" cy="27" r="25" fill="#3B82F6" fill-opacity="0.2"/>
              <circle cx="27" cy="27" r="18" fill="#2563EB" stroke="#FFFFFF" stroke-width="3" filter="url(#carShadow)"/>
              <path d="M20 29a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-17-7l2-5h16l2 5h2a2 2 0 0 1 2 2v6h-2a3 3 0 0 1-6 0h-8a3 3 0 0 1-6 0h-2v-6a2 2 0 0 1 2-2h2zm2-1l-1.5 4h19l-1.5-4H21z" fill="#FFFFFF"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        };

        const marker = new google.maps.Marker({
          position: techPos,
          map: mapRef.current,
          title: technicianInfo?.name ? `Service Partner: ${technicianInfo.name}` : 'Service Partner',
          icon: technicianVehicleSvg,
          zIndex: 200,
        });

        marker.addListener('click', () => {
          const techName = technicianInfo?.name || 'Service Partner';
          const techTitle = technicianInfo?.title || 'Technician';
          const content = `
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 220px;">
              <div style="font-size: 11px; font-weight: 800; color: #2563EB; margin-bottom: 2px;">
                🚗 Service Partner
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #0F172A;">
                ${techName}
              </div>
              <div style="font-size: 10px; color: #64748B; margin-top: 2px;">
                ${techTitle} • On the way to your location
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(mapRef.current, marker);
        });

        techMarkerRef.current = marker;
        currentPosRef.current = { lat: techLat, lng: techLon };
      } else {
        animateVehicleMarker(techLat, techLon);
      }

      if (destLat != null && destLon != null) {
        updateRoadRoute(techLat, techLon, destLat, destLon);
      }
    }
  }, [techLat, techLon, destLat, destLon, technicianInfo, animateVehicleMarker, updateRoadRoute]);

  // Initialize Map
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current) return;
    if (!window.google?.maps?.Map || typeof window.google.maps.Map !== 'function') return;

    try {
      const google = window.google;
      const defaultCenterLat = destLat ?? (techLat ?? 12.9716);
      const defaultCenterLng = destLon ?? (techLon ?? 77.5946);

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: defaultCenterLat, lng: defaultCenterLng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });
      mapRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      // Road Directions Renderer
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2563EB',
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });
      directionsServiceRef.current = directionsService;
      directionsRendererRef.current = directionsRenderer;

      const bounds = new google.maps.LatLngBounds();

      // ── Customer Service Location Marker (Red Pin with Home Icon) ──
      if (destLat != null && destLon != null) {
        const destPos = { lat: destLat, lng: destLon };
        bounds.extend(destPos);

        const customerPinSvg = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.35"/>
                </filter>
              </defs>
              <g filter="url(#shadow)">
                <path d="M23 0C10.3 0 0 10.3 0 23c0 15.2 20.4 30.1 21.3 30.8a2.5 2.5 0 0 0 3.4 0C25.6 53.1 46 38.2 46 23 46 10.3 35.7 0 23 0z" fill="#DC2626" stroke="#FFFFFF" stroke-width="2.5"/>
                <circle cx="23" cy="21" r="14" fill="#FFFFFF"/>
                <path d="M23 12l-8 7v9h5v-6h6v6h5v-9l-8-7z" fill="#DC2626"/>
              </g>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(42, 50),
          anchor: new google.maps.Point(21, 50),
        };

        const custMarker = new google.maps.Marker({
          position: destPos,
          map,
          title: 'Your Service Location',
          icon: customerPinSvg,
          zIndex: 150,
          animation: google.maps.Animation.DROP,
        });
        destMarkerRef.current = custMarker;

        custMarker.addListener('click', () => {
          const content = `
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 240px;">
              <div style="font-size: 11px; font-weight: 800; color: #DC2626; margin-bottom: 2px;">
                🏠 Your Service Location
              </div>
              <div style="font-size: 11px; color: #334155; line-height: 1.3;">
                ${serviceLocation?.address || 'Service Destination'}
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, custMarker);
        });
      }

      // ── Technician Vehicle Marker ──
      if (techLat != null && techLon != null) {
        const techPos = { lat: techLat, lng: techLon };
        bounds.extend(techPos);

        const technicianVehicleSvg = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">
              <defs>
                <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1E3A8A" flood-opacity="0.45"/>
                </filter>
              </defs>
              <circle cx="27" cy="27" r="25" fill="#3B82F6" fill-opacity="0.2"/>
              <circle cx="27" cy="27" r="18" fill="#2563EB" stroke="#FFFFFF" stroke-width="3" filter="url(#carShadow)"/>
              <path d="M20 29a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-17-7l2-5h16l2 5h2a2 2 0 0 1 2 2v6h-2a3 3 0 0 1-6 0h-8a3 3 0 0 1-6 0h-2v-6a2 2 0 0 1 2-2h2zm2-1l-1.5 4h19l-1.5-4H21z" fill="#FFFFFF"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        };

        const techMarker = new google.maps.Marker({
          position: techPos,
          map,
          title: technicianInfo?.name ? `Service Partner: ${technicianInfo.name}` : 'Service Partner',
          icon: technicianVehicleSvg,
          zIndex: 200,
        });
        techMarkerRef.current = techMarker;
        currentPosRef.current = { lat: techLat, lng: techLon };

        techMarker.addListener('click', () => {
          const techName = technicianInfo?.name || 'Service Partner';
          const techTitle = technicianInfo?.title || 'Technician';
          const content = `
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 220px;">
              <div style="font-size: 11px; font-weight: 800; color: #2563EB; margin-bottom: 2px;">
                🚗 Service Partner
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #0F172A;">
                ${techName}
              </div>
              <div style="font-size: 10px; color: #64748B; margin-top: 2px;">
                ${techTitle} • On the way to your location
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, techMarker);
        });

        if (destLat != null && destLon != null) {
          updateRoadRoute(techLat, techLon, destLat, destLon, true);
        }
      }

      // Auto-fit bounds
      if (destLat != null && techLat != null) {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      } else if (destLat != null) {
        map.setCenter({ lat: destLat, lng: destLon });
        map.setZoom(15);
      }
    } catch (err) {
      console.warn('Map rendering error:', err);
    }
  }, [apiLoaded, destLat, destLon, techLat, techLon, technicianInfo, updateRoadRoute]);

  // Clean up animation frame
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Fit both markers into view
  const handleFitRouteBounds = () => {
    if (mapRef.current && window.google?.maps && destLat != null) {
      if (techLat != null) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: destLat, lng: destLon });
        bounds.extend({ lat: techLat, lng: techLon });
        mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else {
        mapRef.current.panTo({ lat: destLat, lng: destLon });
        mapRef.current.setZoom(16);
      }
    }
  };

  // Recenter on destination
  const handleFocusDestination = () => {
    if (mapRef.current && destLat != null && destLon != null) {
      mapRef.current.panTo({ lat: destLat, lng: destLon });
      mapRef.current.setZoom(17);
    }
  };

  // Recenter on technician
  const handleFocusTechnician = () => {
    if (mapRef.current && techLat != null && techLon != null) {
      mapRef.current.panTo({ lat: techLat, lng: techLon });
      mapRef.current.setZoom(17);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md">
      {/* Directions Notice if route lookup fails */}
      {directionsFailed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Turn-by-turn route preview is currently unavailable.</span>
          </span>
        </div>
      )}

      {/* Map Canvas */}
      <div className="relative w-full h-[320px] sm:h-[400px] bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Customer Viewport Controls (Top-Right) */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            type="button"
            onClick={handleFitRouteBounds}
            title="Show Full Route"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 rounded-xl shadow-md border border-slate-200/90 text-xs font-semibold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <Compass className="w-4 h-4 text-blue-600" />
          </button>
          <button
            type="button"
            onClick={handleFocusDestination}
            title="Focus Service Location"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-red-600 rounded-xl shadow-md border border-slate-200/90 text-xs font-semibold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <MapPin className="w-4 h-4 text-red-600" />
          </button>
          {techLat != null && (
            <button
              type="button"
              onClick={handleFocusTechnician}
              title="Focus Service Partner"
              className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 rounded-xl shadow-md border border-slate-200/90 text-xs font-semibold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
            >
              <Car className="w-4 h-4 text-blue-600" />
            </button>
          )}
        </div>

        {/* Customer-Facing Map Legend (Bottom-Left) */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-md text-[11px] space-y-1.5 z-10">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white">
              🚗
            </span>
            <span>Service Partner</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center text-[8px] text-white">
              🏠
            </span>
            <span>Your Service Location</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-blue-700">
            <span className="w-4 h-1 rounded-full bg-blue-600 shadow-sm" />
            <span>Route to Your Location</span>
          </div>
        </div>

        {/* Fallback if Maps API fails to load */}
        {apiError && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white z-20">
            <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
            <p className="text-sm font-bold mb-1">Live Map Temporarily Unavailable</p>
            <p className="text-xs text-slate-300 max-w-sm">{apiError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerTrackingMap;
