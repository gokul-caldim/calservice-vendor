/**
 * JobTrackingMap.jsx
 *
 * Ultra-Clear Swiggy / Rapido Style Live Customer Location & Navigation Route Tracking.
 *
 * Features:
 *  - Instant automatic GPS detection on component mount (zero manual clicks required).
 *  - Crystal-clear visual identification:
 *      * 🏠 Custom Vivid Red Customer Pin with Home Badge & Floating Site Label.
 *      * 🚗 Custom Electric Blue Moving Technician Vehicle Pin with Pulsing Radar Halo.
 *      * 🟢 Translucent 300m Automatic Arrival Geofence Zone.
 *  - Real road network turn-by-turn routing via Google Maps Directions API.
 *  - Real-time Road Distance (e.g. "2.4 km") and Driving ETA (e.g. "8 min", "Arriving now").
 *  - Prominent Floating Customer Identity & Action Card overlay.
 *  - Follow-Me Mode (auto-tracks vehicle; pauses on map drag; 1-click resume).
 *  - 1-Tap Google Maps Driving Navigation Launcher.
 *  - Zero manual arrival buttons (100% backend automatic geofence evaluation).
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  Crosshair,
  Compass,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RotateCw,
  CheckCircle2,
  Car,
  Activity,
  Home,
  Clock,
  Radio,
  Zap,
  Phone,
  LocateFixed,
} from 'lucide-react';
import { getGPSPosition } from '../../hooks/useGPSPosition.js';
import { apiUpdateLocationFull } from '../../api/workforceService.js';
import { loadMapsApi } from '../../utils/loadGoogleMaps.js';
import { TechnicianNavigationView } from './navigation/TechnicianNavigationView.jsx';

// Calculate Haversine direct distance in meters
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000; // meters
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

export const ROUTE_MIN_MOVEMENT_METERS = 50;
export const ROUTE_MIN_REFRESH_SECONDS = 30;
export const ROUTE_REQUEST_TIMEOUT_MS = 8000;

export function JobTrackingMap({
  job,
  technicianLocation,
  preServiceState = {},
  geofenceRadius = 300,
  viewRole = 'technician', // 'technician' or 'customer'
}) {
  if (viewRole === 'technician') {
    return (
      <TechnicianNavigationView
        job={job}
        technicianLocation={technicianLocation}
        preServiceState={preServiceState}
        geofenceRadius={geofenceRadius}
      />
    );
  }

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const techMarkerRef = useRef(null);
  const custMarkerRef = useRef(null);
  const geofenceCircleRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const fallbackPolylineRef = useRef(null);
  const infoWindowRef = useRef(null);
  const lastDirectionsTimeRef = useRef(0);
  const lastRoutedCoordsRef = useRef({ lat: null, lng: null });
  const lastDestCoordsRef = useRef({ lat: null, lng: null });

  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [liveTechCoords, setLiveTechCoords] = useState(technicianLocation || null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [roadEtaText, setRoadEtaText] = useState(null);
  const [roadDistanceText, setRoadDistanceText] = useState(null);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [isFollowMe, setIsFollowMe] = useState(true);
  const [lastUpdateSecondsAgo, setLastUpdateSecondsAgo] = useState(0);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  const custLat = job?.latitude != null ? parseFloat(job.latitude) : null;
  const custLon = job?.longitude != null ? parseFloat(job.longitude) : null;

  // Load Google Maps API script
  useEffect(() => {
    if (!apiKey) {
      setApiError('Google Maps API key is not configured (VITE_GOOGLE_MAPS_KEY missing).');
      return;
    }
    loadMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch((err) => {
        console.warn('Google Maps load warning:', err);
        setApiError('Could not load Google Maps.');
      });
  }, [apiKey]);

  // Sync initial technician location from centralized prop
  useEffect(() => {
    if (technicianLocation?.latitude != null && technicianLocation?.longitude != null) {
      setLiveTechCoords({
        latitude: parseFloat(technicianLocation.latitude),
        longitude: parseFloat(technicianLocation.longitude),
        accuracy: technicianLocation.accuracy,
        speed: technicianLocation.speed,
        heading: technicianLocation.heading,
        updated_at: technicianLocation.updated_at || new Date().toISOString(),
      });
    }
  }, [technicianLocation]);

  // Recalculate straight distance
  useEffect(() => {
    if (custLat != null && custLon != null && liveTechCoords?.latitude != null && liveTechCoords?.longitude != null) {
      const dist = calculateDistanceMeters(
        liveTechCoords.latitude,
        liveTechCoords.longitude,
        custLat,
        custLon
      );
      setDistanceMeters(dist);
    }
  }, [custLat, custLon, liveTechCoords]);

  // Location Freshness Timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (liveTechCoords?.updated_at) {
        const diffSec = Math.max(0, Math.round((Date.now() - new Date(liveTechCoords.updated_at).getTime()) / 1000));
        setLastUpdateSecondsAgo(diffSec);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [liveTechCoords]);

  const animFrameRef = useRef(null);
  const currentPosRef = useRef({ lat: null, lng: null });
  const isRoutePendingRef = useRef(false);
  const cachedRouteRef = useRef(null);
  const [directionsFailed, setDirectionsFailed] = useState(false);

  // Generates high-contrast vehicle marker with dynamic movement heading rotation
  const getVehicleMarkerIcon = useCallback((heading = null) => {
    if (!window.google?.maps) return null;
    const hasValidHeading = heading != null && !isNaN(heading) && heading >= 0;
    const rotationTransform = hasValidHeading ? `transform="rotate(${heading} 27 27)"` : '';
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">
          <defs>
            <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1E3A8A" flood-opacity="0.45"/>
            </filter>
          </defs>
          <circle cx="27" cy="27" r="25" fill="#3B82F6" fill-opacity="0.2"/>
          <circle cx="27" cy="27" r="18" fill="#2563EB" stroke="#FFFFFF" stroke-width="3" filter="url(#carShadow)"/>
          <g ${rotationTransform}>
            <path d="M20 29a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-17-7l2-5h16l2 5h2a2 2 0 0 1 2 2v6h-2a3 3 0 0 1-6 0h-8a3 3 0 0 1-6 0h-2v-6a2 2 0 0 1 2-2h2zm2-1l-1.5 4h19l-1.5-4H21z" fill="#FFFFFF"/>
          </g>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(48, 48),
      anchor: new window.google.maps.Point(24, 24),
    };
  }, []);

  // Smooth UI Marker Interpolation Engine (Rapido/Swiggy style smooth movement)
  const animateVehicleMarker = useCallback((targetLat, targetLng, heading = null) => {
    if (!techMarkerRef.current || !window.google?.maps) return;

    // Update marker heading rotation
    if (heading != null && !isNaN(heading) && heading >= 0) {
      const icon = getVehicleMarkerIcon(heading);
      if (icon) techMarkerRef.current.setIcon(icon);
    }

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
      // Ease out cubic
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
  }, [getVehicleMarkerIcon]);

  // Request road directions and ETA via Google Maps Directions API with strict cost controls & in-flight deduplication
  const updateRoadRoute = useCallback((originLat, originLng, destLat, destLng, force = false) => {
    if (!window.google?.maps || !directionsServiceRef.current || !directionsRendererRef.current) return;

    // Active-job-only routing: do not route if job is completed or cancelled
    if (job?.status && ['completed', 'cancelled'].includes(job.status.toLowerCase())) {
      return;
    }

    // Deduplicate in-flight requests
    if (isRoutePendingRef.current) return;

    const now = Date.now();
    const destChanged =
      lastDestCoordsRef.current.lat !== destLat ||
      lastDestCoordsRef.current.lng !== destLng;

    // Debounce & throttle directions requests:
    // Only call Google Directions if forced, destination changed, or technician moved >= 50m and >= 30s elapsed
    if (!force && !destChanged && lastRoutedCoordsRef.current.lat != null && lastRoutedCoordsRef.current.lng != null) {
      const movedDist = calculateDistanceMeters(
        originLat,
        originLng,
        lastRoutedCoordsRef.current.lat,
        lastRoutedCoordsRef.current.lng
      );
      if (
        movedDist != null &&
        movedDist < ROUTE_MIN_MOVEMENT_METERS &&
        now - lastDirectionsTimeRef.current < ROUTE_MIN_REFRESH_SECONDS * 1000
      ) {
        return; // Reuse cached road route
      }
    }

    lastDirectionsTimeRef.current = now;
    lastRoutedCoordsRef.current = { lat: originLat, lng: originLng };
    lastDestCoordsRef.current = { lat: destLat, lng: destLng };

    const origin = new window.google.maps.LatLng(originLat, originLng);
    const dest = new window.google.maps.LatLng(destLat, destLng);

    isRoutePendingRef.current = true;
    const reqStartTime = performance.now();
    console.info(`[MAP_ROUTE_REQUEST] job_id=${job?.id || 'active'} origin=(${originLat},${originLng}) destination=(${destLat},${destLng})`);

    directionsServiceRef.current.route(
      {
        origin,
        destination: dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
        avoidTolls: false,
      },
      (result, status) => {
        isRoutePendingRef.current = false;
        const durationMs = Math.round(performance.now() - reqStartTime);

        if (status === window.google.maps.DirectionsStatus.OK && result) {
          cachedRouteRef.current = result;
          const route = result.routes[0]?.legs[0];
          console.info(`[MAP_ROUTE_SUCCESS] job_id=${job?.id || 'active'} duration_ms=${durationMs} distance_m=${route?.distance?.value || 0} provider=GoogleDirections`);
          directionsRendererRef.current.setDirections(result);
          setDirectionsFailed(false);
          if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
          }
          if (route) {
            setRoadEtaText(route.duration?.text || null);
            setRoadDistanceText(route.distance?.text || null);
          }
        } else {
          console.warn(`[MAP_ROUTE_FAILURE] job_id=${job?.id || 'active'} error=${status}`);
          // Failure: Clean fallback without drawing a fake straight road route
          setDirectionsFailed(true);
          if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
          }
          setRoadEtaText(null);
          setRoadDistanceText(null);
        }
      }
    );
  }, [job?.id, job?.status]);

  // Listen to live GPS location updates from single global watcher
  useEffect(() => {
    const handleLocationUpdate = (e) => {
      const detail = e.detail;
      if (detail?.latitude != null && detail?.longitude != null) {
        const newCoords = {
          latitude: parseFloat(detail.latitude),
          longitude: parseFloat(detail.longitude),
          accuracy: detail.accuracy,
          speed: detail.speed,
          heading: detail.heading,
          updated_at: new Date().toISOString(),
        };
        setLiveTechCoords(newCoords);

        if (mapRef.current && window.google?.maps) {
          try {
            const google = window.google;
            const latLng = new google.maps.LatLng(newCoords.latitude, newCoords.longitude);

            if (!techMarkerRef.current) {
              const icon = getVehicleMarkerIcon(newCoords.heading);
              techMarkerRef.current = new google.maps.Marker({
                position: latLng,
                map: mapRef.current,
                title: viewRole === 'customer' ? 'Technician Live Location' : 'You (Technician)',
                icon: icon,
                zIndex: 200,
              });
              currentPosRef.current = { lat: newCoords.latitude, lng: newCoords.longitude };
            } else {
              // Smooth vehicle marker interpolation & heading rotation
              animateVehicleMarker(newCoords.latitude, newCoords.longitude, newCoords.heading);
            }

            // Follow-me auto pan
            if (isFollowMe && mapRef.current) {
              mapRef.current.panTo(latLng);
            }

            // Dynamically recalculate driving route and ETA
            if (custLat != null && custLon != null) {
              updateRoadRoute(newCoords.latitude, newCoords.longitude, custLat, custLon);
            }
          } catch (_) {}
        }
      }
    };

    window.addEventListener('workforce:location-updated', handleLocationUpdate);
    return () => {
      window.removeEventListener('workforce:location-updated', handleLocationUpdate);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [animateVehicleMarker, custLat, custLon, getVehicleMarkerIcon, isFollowMe, updateRoadRoute, viewRole]);

  // Initialize interactive Google Map with custom high-visibility SVG pins
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current) return;
    if (!window.google?.maps?.Map || typeof window.google.maps.Map !== 'function' || !window.google?.maps?.ControlPosition) return;

    try {
      const google = window.google;

      const defaultCenterLat = custLat ?? (liveTechCoords?.latitude != null ? liveTechCoords.latitude : 0);
      const defaultCenterLng = custLon ?? (liveTechCoords?.longitude != null ? liveTechCoords.longitude : 0);

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

      // Pause Follow-Me mode when user manually drags/pans map
      map.addListener('dragstart', () => {
        setIsFollowMe(false);
      });

      // Swiggy / Rapido Style Road Directions Service & Renderer
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // Use custom high-contrast SVG pins
        polylineOptions: {
          strokeColor: '#2563EB', // Electric Blue Primary Route
          strokeWeight: 6,
          strokeOpacity: 0.9,
        },
      });
      directionsServiceRef.current = directionsService;
      directionsRendererRef.current = directionsRenderer;

      const bounds = new google.maps.LatLngBounds();

      // ── 1. High-Visibility Customer Destination Marker (🏠 Vivid Red Pin with Home Icon) ──
      if (custLat != null && custLon != null) {
        const custPos = { lat: custLat, lng: custLon };
        bounds.extend(custPos);

        // Custom High-Resolution SVG Customer Pin
        const customerPinSvg = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
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
          position: custPos,
          map,
          title: `Customer Site: ${job.address || 'Service Location'}`,
          icon: customerPinSvg,
          zIndex: 150,
          animation: google.maps.Animation.DROP,
        });
        custMarkerRef.current = custMarker;

        custMarker.addListener('click', () => {
          const content = `
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 250px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="background: #FEE2E2; color: #991B1B; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                  Customer Site
                </span>
                <span style="font-weight: 700; font-size: 11px; color: #1E293B;">
                  Job #${job.request_id || job.id}
                </span>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 2px;">
                ${job.customer_name || 'Customer Site'}
              </div>
              <div style="font-size: 11px; color: #64748B; margin-bottom: 6px; line-height: 1.3;">
                ${job.address || 'Destination Address'}
              </div>
              <div style="border-top: 1px solid #E2E8F0; padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; font-weight: 600; color: #2563EB;">
                  ${job.issue_title || job.service_category || 'Service Request'}
                </span>
                <span style="font-size: 10px; color: #10B981; font-weight: 700;">
                  300m Arrival Zone
                </span>
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, custMarker);
        });

        // ── 2. Geofence Arrival Radius Circle (300m visual guidance) ──
        const geofenceCircle = new google.maps.Circle({
          map,
          center: custPos,
          radius: geofenceRadius,
          strokeColor: '#10B981', // Emerald
          strokeOpacity: 0.85,
          strokeWeight: 2.5,
          fillColor: '#10B981',
          fillOpacity: 0.12,
          zIndex: 10,
        });
        geofenceCircleRef.current = geofenceCircle;
      }

      // ── 3. High-Visibility Technician Moving Vehicle Marker (🚗 Blue Van with Pulsing Radar Halo) ──
      if (liveTechCoords?.latitude != null && liveTechCoords?.longitude != null) {
        const techPos = { lat: liveTechCoords.latitude, lng: liveTechCoords.longitude };
        bounds.extend(techPos);

        const technicianVehicleSvg = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">
              <defs>
                <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1E3A8A" flood-opacity="0.45"/>
                </filter>
              </defs>
              <!-- Outer Radar Ripple -->
              <circle cx="27" cy="27" r="25" fill="#3B82F6" fill-opacity="0.2"/>
              <!-- Core Badge -->
              <circle cx="27" cy="27" r="18" fill="#2563EB" stroke="#FFFFFF" stroke-width="3" filter="url(#carShadow)"/>
              <!-- Service Van / Car SVG -->
              <path d="M20 29a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-17-7l2-5h16l2 5h2a2 2 0 0 1 2 2v6h-2a3 3 0 0 1-6 0h-8a3 3 0 0 1-6 0h-2v-6a2 2 0 0 1 2-2h2zm2-1l-1.5 4h19l-1.5-4H21z" fill="#FFFFFF"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        };

        const techMarker = new google.maps.Marker({
          position: techPos,
          map,
          title: viewRole === 'customer' ? 'Technician Live Location' : 'You (Technician)',
          icon: technicianVehicleSvg,
          zIndex: 200,
        });
        techMarkerRef.current = techMarker;

        techMarker.addListener('click', () => {
          const accuracyText = liveTechCoords.accuracy ? `±${Math.round(liveTechCoords.accuracy)}m` : 'GPS Fix';
          const content = `
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px;">
              <div style="font-size: 11px; font-weight: 800; color: #2563EB; margin-bottom: 2px;">
                🚗 ${viewRole === 'customer' ? 'Assigned Technician Location' : 'Your Live Location (Technician)'}
              </div>
              <div style="font-size: 10px; color: #64748B;">
                GPS Accuracy: ${accuracyText} • Driving to Customer
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, techMarker);
        });

        // Calculate initial road route and ETA
        if (custLat != null && custLon != null) {
          updateRoadRoute(liveTechCoords.latitude, liveTechCoords.longitude, custLat, custLon, true);
        }
      }

      // Auto-fit bounds
      if (custLat != null && liveTechCoords?.latitude != null) {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      }
    } catch (err) {
      console.warn('Map rendering error:', err);
    }
  }, [apiLoaded, custLat, custLon, updateRoadRoute, viewRole]);

  // Recenter map on customer
  const handleFocusCustomer = () => {
    if (mapRef.current && custLat != null && custLon != null) {
      setIsFollowMe(false);
      mapRef.current.panTo({ lat: custLat, lng: custLon });
      mapRef.current.setZoom(17);
    }
  };

  // Follow Me toggle / Recenter on technician
  const handleToggleFollowMe = () => {
    const next = !isFollowMe;
    setIsFollowMe(next);
    if (mapRef.current && liveTechCoords?.latitude != null && liveTechCoords?.longitude != null) {
      mapRef.current.panTo({ lat: liveTechCoords.latitude, lng: liveTechCoords.longitude });
      mapRef.current.setZoom(17);
    }
  };

  // Fit both markers into viewport (Fit Route)
  const handleFitRouteBounds = () => {
    setIsFollowMe(false);
    if (mapRef.current && window.google?.maps && custLat != null && liveTechCoords?.latitude != null) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: custLat, lng: custLon });
      bounds.extend({ lat: liveTechCoords.latitude, lng: liveTechCoords.longitude });
      mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  };

  // Manual GPS refresh / Fix
  const handleManualGpsRefresh = async () => {
    if (isRefreshingGps) return;
    setIsRefreshingGps(true);
    try {
      const pos = await getGPSPosition(true);
      const { latitude, longitude, accuracy } = pos.coords;
      await apiUpdateLocationFull(latitude, longitude, accuracy);
      const newCoords = {
        latitude,
        longitude,
        accuracy,
        updated_at: new Date().toISOString(),
      };
      setLiveTechCoords(newCoords);
      window.dispatchEvent(
        new CustomEvent('workforce:location-updated', {
          detail: {
            latitude,
            longitude,
            accuracy,
            timestamp: Date.now(),
            source: 'manual_fix',
          },
        })
      );
      if (custLat != null && custLon != null) {
        updateRoadRoute(latitude, longitude, custLat, custLon, true);
      }
    } catch (_) {
    } finally {
      setIsRefreshingGps(false);
    }
  };

  // Authoritative Backend Arrival Status
  const isBackendArrived = Boolean(
    job?.status === 'arrived' ||
    job?.status === 'in_progress' ||
    job?.status === 'completed' ||
    preServiceState?.geofence_passed
  );

  // Status computation for operational banner
  const statusInfo = useMemo(() => {
    if (!liveTechCoords?.latitude || !liveTechCoords?.longitude) {
      return { code: 'NO_LOCATION', label: 'ACQUIRING LIVE GPS', sub: 'Fetching high-accuracy vehicle telemetry...', tone: 'amber' };
    }
    if (lastUpdateSecondsAgo > 300) {
      return { code: 'LOCATION_STALE', label: 'LOCATION STALE', sub: `Last updated ${Math.round(lastUpdateSecondsAgo / 60)}m ago. Tap Refresh GPS.`, tone: 'amber' };
    }
    if (job?.status === 'completed') {
      return { code: 'COMPLETED', label: 'JOB COMPLETED', sub: 'Service completed successfully.', tone: 'emerald' };
    }
    if (job?.status === 'in_progress') {
      return { code: 'IN_PROGRESS', label: 'WORK IN PROGRESS', sub: 'Technician currently servicing appliance at customer site.', tone: 'blue' };
    }
    if (isBackendArrived) {
      return { code: 'ARRIVED', label: 'ARRIVAL VERIFIED', sub: 'Inside 300m site perimeter. Customer Work Start OTP required.', tone: 'emerald' };
    }
    if (distanceMeters != null && distanceMeters <= geofenceRadius) {
      return { code: 'ARRIVING_NOW', label: 'ARRIVING SOON', sub: 'Entering 300m arrival perimeter...', tone: 'blue' };
    }
    if (distanceMeters != null && distanceMeters <= 1000) {
      return { code: 'APPROACHING', label: 'APPROACHING CUSTOMER', sub: 'Technician is within 1 km of destination.', tone: 'blue' };
    }
    return { code: 'ON_THE_WAY', label: 'ON THE WAY', sub: 'Driving along authorized road route.', tone: 'slate' };
  }, [liveTechCoords, lastUpdateSecondsAgo, job?.status, isBackendArrived, distanceMeters, geofenceRadius]);

  // Formatted direct distance fallback
  const displayDirectDistance = distanceMeters != null
    ? distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${distanceMeters} m`
    : 'Calculating...';

  const displayDistance = !directionsFailed && roadDistanceText ? roadDistanceText : displayDirectDistance;

  const displayEta = !directionsFailed && roadEtaText ? roadEtaText : (
    distanceMeters != null
      ? distanceMeters <= 300
        ? 'Arriving now'
        : `${Math.max(1, Math.round((distanceMeters / 1000) * 3))} min`
      : '--'
  );

  // Telemetry Freshness Classification (Rapido/Swiggy Rule)
  const freshnessInfo = useMemo(() => {
    if (!liveTechCoords?.updated_at) return { label: 'ACQUIRING', tone: 'slate' };
    if (lastUpdateSecondsAgo <= 5) return { label: 'LIVE', tone: 'emerald' };
    if (lastUpdateSecondsAgo <= 15) return { label: 'UPDATING', tone: 'blue' };
    if (lastUpdateSecondsAgo <= 30) return { label: 'DELAYED', tone: 'amber' };
    if (lastUpdateSecondsAgo <= 60) return { label: 'STALE', tone: 'orange' };
    return { label: 'LOCATION LOST', tone: 'rose' };
  }, [liveTechCoords, lastUpdateSecondsAgo]);

  // GPS Accuracy & Quality Assessment
  const accuracyMeters = liveTechCoords?.accuracy != null ? Math.round(liveTechCoords.accuracy) : null;
  const isAccuracyLow = accuracyMeters != null && accuracyMeters > 50;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg">
      {/* ── Directions API Failure Notice ── */}
      {directionsFailed && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-900 font-medium">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Road route temporarily unavailable — Showing direct distance ({displayDirectDistance})</span>
          </span>
          <span className="text-[10px] text-amber-700 font-mono">Direct Line</span>
        </div>
      )}

      {/* ── Swiggy / Rapido Operational Header Tracking Panel ── */}
      <div className="p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status & Vehicle Indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              {isBackendArrived ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-pulse" />
              ) : (
                <Car className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-white tracking-wider uppercase flex items-center gap-1.5">
                  <span>🚗 {statusInfo.label}</span>
                  {!isBackendArrived && liveTechCoords?.latitude && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                </h3>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5 font-medium">
                {statusInfo.sub}
              </p>
            </div>
          </div>

          {/* Real-Time Live Road ETA, Distance Badge & Quick Navigation */}
          <div className="flex items-center gap-2.5 ml-auto">
            {!liveTechCoords?.latitude && (
              <button
                type="button"
                onClick={handleManualGpsRefresh}
                disabled={isRefreshingGps}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 animate-pulse"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>{isRefreshingGps ? 'Locating...' : 'Enable Live GPS'}</span>
              </button>
            )}

            {liveTechCoords?.latitude && !isBackendArrived && (
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-lg px-3 py-1 text-center backdrop-blur-sm">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  ETA
                </span>
                <span className="text-sm font-black font-mono text-emerald-400 tracking-tight">
                  {displayEta}
                </span>
              </div>
            )}

            {liveTechCoords?.latitude && (
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-lg px-3 py-1 text-center backdrop-blur-sm">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-400" />
                  {directionsFailed ? 'Direct Dist' : 'Remaining'}
                </span>
                <span className="text-sm font-black font-mono text-white tracking-tight">
                  {displayDistance}
                </span>
              </div>
            )}

            {viewRole === 'technician' && job?.latitude != null && job?.longitude != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition-all shrink-0 active:scale-95"
                title="Launch turn-by-turn navigation in Google Maps app"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigate ↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Customer Destination Address Ribbon & Live GPS Quality Indicators */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <Home className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="font-semibold text-slate-200 shrink-0">
              {viewRole === 'customer' ? 'Your Location:' : 'Customer Site:'}
            </span>
            <span className="truncate text-slate-300">{job?.address || 'Service Destination'}</span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 text-[10px] font-mono">
            {/* Freshness Badge */}
            <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
              freshnessInfo.tone === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              freshnessInfo.tone === 'blue' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
              freshnessInfo.tone === 'amber' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              freshnessInfo.tone === 'orange' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
              'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              ● {freshnessInfo.label} ({lastUpdateSecondsAgo}s)
            </span>

            {accuracyMeters != null && (
              <span className={`px-2 py-0.5 rounded ${isAccuracyLow ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'}`}>
                {isAccuracyLow ? `⚠️ Low GPS (±${accuracyMeters}m)` : `GPS ±${accuracyMeters}m`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Interactive Google Map Container ── */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* ── Floating Customer Destination Badge (Top-Left on Map) ── */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-lg text-slate-800 max-w-[260px] sm:max-w-[300px] z-10">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Customer Destination
            </span>
            {job?.phone && (
              <a
                href={`tel:${job.phone}`}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                title="Call Customer"
              >
                <Phone className="w-3 h-3" />
                <span>Call</span>
              </a>
            )}
          </div>
          <p className="text-xs font-bold text-slate-900 truncate">
            {job?.customer_name || 'Customer Site'}
          </p>
          <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight mt-0.5">
            {job?.address || 'Destination Address'}
          </p>
        </div>

        {/* ── Map Viewport Controls Overlay (Top-Right) ── */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={handleFitRouteBounds}
            title="Fit Entire Road Route into View"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <Compass className="w-4 h-4 text-blue-600" />
          </button>
          <button
            type="button"
            onClick={handleToggleFollowMe}
            title={isFollowMe ? 'Follow Me Active (Click to Pause)' : 'Follow Me Paused (Click to Enable)'}
            className={`p-2.5 rounded-lg shadow-md border text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95 ${
              isFollowMe
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30'
                : 'bg-white/95 text-slate-700 hover:text-blue-600 border-slate-200'
            }`}
          >
            <Crosshair className={`w-4 h-4 ${isFollowMe ? 'text-white animate-pulse' : 'text-slate-600'}`} />
          </button>
          <button
            type="button"
            onClick={handleFocusCustomer}
            title="Focus Customer Site"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-red-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <MapPin className="w-4 h-4 text-red-600" />
          </button>
          {viewRole === 'technician' && (
            <button
              type="button"
              onClick={handleManualGpsRefresh}
              disabled={isRefreshingGps}
              title="Refresh High-Accuracy GPS Fix"
              className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm disabled:opacity-50 active:scale-95"
            >
              <RotateCw className={`w-4 h-4 text-emerald-600 ${isRefreshingGps ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* ── Map Legend Overlay (Bottom-Left) ── */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200/90 shadow text-[10px] space-y-1.5 z-10">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-600 ring-2 ring-blue-200 flex items-center justify-center text-[8px] text-white">
              🚗
            </span>
            <span>{viewRole === 'customer' ? 'Technician Live Vehicle' : 'Your Live Location (🚗 You)'}</span>
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 ring-2 ring-red-200 flex items-center justify-center text-[8px] text-white">
              🏠
            </span>
            <span>{viewRole === 'customer' ? 'Your Destination' : 'Customer Destination (🏠 Site)'}</span>
          </div>
          <div className="flex items-center gap-2 font-bold text-blue-700">
            <span className="w-5 h-1.5 rounded-full bg-blue-600 shadow-sm" />
            <span>Turn-by-Turn Road Route</span>
          </div>
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-emerald-100" />
            <span>300m Arrival Geofence</span>
          </div>
        </div>

        {/* Fallback Overlay if Maps API encounters network error */}
        {apiError && (
          <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center p-4 text-center text-white z-20">
            <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
            <p className="text-xs font-bold mb-1">Map Visualization Unavailable</p>
            <p className="text-[11px] text-slate-300 max-w-xs mb-3">{apiError}</p>
            {job?.latitude != null && job?.longitude != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps Navigation</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Live Progress & Geofence Status ── */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-700 flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">
            {isBackendArrived ? (
              <strong className="text-emerald-700 font-bold">
                ✓ ARRIVAL VERIFIED — Arrived within 300m of customer site.
                {viewRole === 'technician' ? ' Ask customer for Work Start OTP.' : ' Share your 6-digit OTP with technician.'}
              </strong>
            ) : (
              <span>
                Move along the road route. Backend GPS automatically verifies arrival within <strong className="text-slate-900 font-bold">300 meters</strong> of customer destination.
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isFollowMe ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-200 text-slate-700'}`}>
            {isFollowMe ? 'FOLLOW ME ON' : 'PAN MODE'}
          </span>
        </div>
      </div>
    </div>
  );
}
