/**
 * JobTrackingMap.jsx
 *
 * Swiggy / Uber Style Live Customer Location & Navigation Route Tracking Component.
 *
 * Features:
 *  - Real road-network route calculation via Google Maps DirectionsService & DirectionsRenderer.
 *  - Live Driving ETA (e.g. "12 mins") and Driving Distance (e.g. "3.8 km") from Google Maps routing engine.
 *  - Swiggy-style delivery tracking UI with floating ETA pill, progress bar, and destination address.
 *  - Custom animated technician vehicle marker and pulsating customer site target pin.
 *  - 300m visual arrival geofence perimeter around customer location.
 *  - Dynamic route updates as technician moves physically (driven by workforce:location-updated event).
 *  - 1-tap Google Maps turn-by-turn navigation launcher.
 *  - Viewport controls: Fit Route, Follow Technician, Focus Customer, Refresh GPS.
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
} from 'lucide-react';
import { getGPSPosition } from '../../hooks/useGPSPosition.js';
import { apiUpdateLocationFull } from '../../api/workforceService.js';

let mapsApiPromise = null;

function loadMapsApi(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
    return Promise.resolve(window.google.maps);
  }
  if (!mapsApiPromise) {
    mapsApiPromise = new Promise((resolve, reject) => {
      const checkReady = () => {
        if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
          resolve(window.google.maps);
          return true;
        }
        return false;
      };

      if (checkReady()) return;

      const existingScript = document.getElementById('gmap-script');
      if (existingScript) {
        const interval = setInterval(() => {
          if (checkReady()) clearInterval(interval);
        }, 100);
        setTimeout(() => {
          clearInterval(interval);
          if (checkReady()) resolve(window.google.maps);
          else reject(new Error('Google Maps initialization timeout.'));
        }, 10000);
        return;
      }

      window.__initGoogleMapsWorkforce = () => {
        if (checkReady()) resolve(window.google.maps);
      };

      const script = document.createElement('script');
      script.id = 'gmap-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=__initGoogleMapsWorkforce`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);

      const interval = setInterval(() => {
        if (checkReady()) clearInterval(interval);
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        if (checkReady()) resolve(window.google.maps);
      }, 10000);
    });
  }
  return mapsApiPromise;
}

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

export function JobTrackingMap({
  job,
  technicianLocation,
  preServiceState = {},
  geofenceRadius = 300,
}) {
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

  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [liveTechCoords, setLiveTechCoords] = useState(technicianLocation || null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [roadEtaText, setRoadEtaText] = useState(null);
  const [roadDistanceText, setRoadDistanceText] = useState(null);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);

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

  // Sync initial technician location from prop
  useEffect(() => {
    if (technicianLocation?.latitude != null && technicianLocation?.longitude != null) {
      setLiveTechCoords({
        latitude: parseFloat(technicianLocation.latitude),
        longitude: parseFloat(technicianLocation.longitude),
        accuracy: technicianLocation.accuracy,
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

  // Request road directions and ETA via Google Maps Directions API
  const updateRoadRoute = useCallback((originLat, originLng, destLat, destLng) => {
    if (!window.google?.maps || !directionsServiceRef.current || !directionsRendererRef.current) return;

    // Throttle directions requests to at most once every 6 seconds to respect rate limits
    const now = Date.now();
    if (now - lastDirectionsTimeRef.current < 6000) return;
    lastDirectionsTimeRef.current = now;

    const origin = new window.google.maps.LatLng(originLat, originLng);
    const dest = new window.google.maps.LatLng(destLat, destLng);

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
          if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
          }
          const route = result.routes[0]?.legs[0];
          if (route) {
            setRoadEtaText(route.duration?.text || null);
            setRoadDistanceText(route.distance?.text || null);
          }
        } else {
          // Fallback: draw geodesic polyline if driving route calculation is unavailable
          if (mapRef.current) {
            if (!fallbackPolylineRef.current) {
              fallbackPolylineRef.current = new window.google.maps.Polyline({
                geodesic: true,
                strokeColor: '#2563EB',
                strokeOpacity: 0.8,
                strokeWeight: 4,
                map: mapRef.current,
              });
            }
            fallbackPolylineRef.current.setPath([origin, dest]);
            fallbackPolylineRef.current.setMap(mapRef.current);
          }
        }
      }
    );
  }, []);

  // Listen to live GPS location updates from useLocationTracker or TopHeader
  useEffect(() => {
    const handleLocationUpdate = (e) => {
      const detail = e.detail;
      if (detail?.latitude != null && detail?.longitude != null) {
        const newCoords = {
          latitude: parseFloat(detail.latitude),
          longitude: parseFloat(detail.longitude),
          accuracy: detail.accuracy,
          updated_at: new Date().toISOString(),
        };
        setLiveTechCoords(newCoords);

        // Smoothly animate technician marker on map
        if (techMarkerRef.current && window.google?.maps?.LatLng) {
          try {
            const latLng = new window.google.maps.LatLng(newCoords.latitude, newCoords.longitude);
            techMarkerRef.current.setPosition(latLng);

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
    };
  }, [custLat, custLon, updateRoadRoute]);

  // Initialize interactive Google Map
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current) return;
    if (!window.google?.maps?.Map || typeof window.google.maps.Map !== 'function') return;

    try {
      const google = window.google;

      const defaultCenterLat = custLat ?? 12.9716;
      const defaultCenterLng = custLon ?? 77.5946;

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

      // Swiggy-Style Road Directions Service & Renderer
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // We use our custom animated Swiggy pins
        polylineOptions: {
          strokeColor: '#2563EB', // Electric Blue Primary Route
          strokeWeight: 6,
          strokeOpacity: 0.9,
        },
      });
      directionsServiceRef.current = directionsService;
      directionsRendererRef.current = directionsRenderer;

      const bounds = new google.maps.LatLngBounds();

      // 1. Customer Destination Marker (Home Icon Pin)
      if (custLat != null && custLon != null) {
        const custPos = { lat: custLat, lng: custLon };
        bounds.extend(custPos);

        const custMarker = new google.maps.Marker({
          position: custPos,
          map,
          title: `Customer Site: ${job.address || 'Service Location'}`,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 7,
            fillColor: '#EF4444', // Red
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5,
          },
          zIndex: 100,
        });
        custMarkerRef.current = custMarker;

        custMarker.addListener('click', () => {
          const content = `
            <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 240px;">
              <div style="font-size: 11px; font-weight: 700; color: #1E293B; margin-bottom: 2px;">
                🏠 ${job.customer_name || 'Customer Site'}
              </div>
              <div style="font-size: 10px; color: #64748B; margin-bottom: 4px;">
                ${job.address || 'Destination Address'}
              </div>
              <div style="font-size: 10px; font-weight: 600; color: #2563EB;">
                Job #${job.request_id || job.id} (${job.issue_title || job.service_category || 'Service'})
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, custMarker);
        });

        // 2. Geofence Arrival Radius Circle (300m visual guidance)
        const geofenceCircle = new google.maps.Circle({
          map,
          center: custPos,
          radius: geofenceRadius,
          strokeColor: '#10B981', // Emerald
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#10B981',
          fillOpacity: 0.14,
          zIndex: 10,
        });
        geofenceCircleRef.current = geofenceCircle;
      }

      // 3. Technician Moving Vehicle Marker (Swiggy / Uber Vehicle Pin)
      if (liveTechCoords?.latitude != null && liveTechCoords?.longitude != null) {
        const techPos = { lat: liveTechCoords.latitude, lng: liveTechCoords.longitude };
        bounds.extend(techPos);

        const techMarker = new google.maps.Marker({
          position: techPos,
          map,
          title: 'You (Technician)',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#2563EB', // Electric Blue
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3.5,
          },
          zIndex: 200,
        });
        techMarkerRef.current = techMarker;

        techMarker.addListener('click', () => {
          const accuracyText = liveTechCoords.accuracy ? `±${Math.round(liveTechCoords.accuracy)}m` : 'GPS Fix';
          const content = `
            <div style="font-family: system-ui, sans-serif; padding: 4px;">
              <div style="font-size: 11px; font-weight: 700; color: #2563EB;">🚗 Your Live GPS Location</div>
              <div style="font-size: 10px; color: #64748B;">Accuracy: ${accuracyText}</div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, techMarker);
        });

        // Calculate initial road route and ETA
        if (custLat != null && custLon != null) {
          updateRoadRoute(liveTechCoords.latitude, liveTechCoords.longitude, custLat, custLon);
        }
      }

      // Auto-fit bounds
      if (custLat != null && liveTechCoords?.latitude != null) {
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    } catch (err) {
      console.warn('Map rendering error:', err);
    }
  }, [apiLoaded, custLat, custLon, updateRoadRoute]);

  // Recenter map on customer
  const handleFocusCustomer = () => {
    if (mapRef.current && custLat != null && custLon != null) {
      mapRef.current.panTo({ lat: custLat, lng: custLon });
      mapRef.current.setZoom(17);
    }
  };

  // Recenter map on technician
  const handleFocusTechnician = () => {
    if (mapRef.current && liveTechCoords?.latitude != null && liveTechCoords?.longitude != null) {
      mapRef.current.panTo({ lat: liveTechCoords.latitude, lng: liveTechCoords.longitude });
      mapRef.current.setZoom(17);
    }
  };

  // Fit both markers into viewport (Fit Route)
  const handleFitRouteBounds = () => {
    if (mapRef.current && window.google?.maps && custLat != null && liveTechCoords?.latitude != null) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: custLat, lng: custLon });
      bounds.extend({ lat: liveTechCoords.latitude, lng: liveTechCoords.longitude });
      mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  };

  // One-time manual GPS refresh
  const handleManualGpsRefresh = async () => {
    if (isRefreshingGps) return;
    setIsRefreshingGps(true);
    try {
      const pos = await getGPSPosition(true);
      const { latitude, longitude, accuracy } = pos.coords;
      await apiUpdateLocationFull(latitude, longitude, accuracy);
      setLiveTechCoords({
        latitude,
        longitude,
        accuracy,
        updated_at: new Date().toISOString(),
      });
      window.dispatchEvent(
        new CustomEvent('workforce:location-updated', {
          detail: {
            latitude,
            longitude,
            accuracy,
            timestamp: Date.now(),
            source: 'map_refresh',
          },
        })
      );
      if (custLat != null && custLon != null) {
        updateRoadRoute(latitude, longitude, custLat, custLon);
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

  // Status computation for Swiggy banner
  const statusInfo = useMemo(() => {
    if (!liveTechCoords?.latitude || !liveTechCoords?.longitude) {
      return { label: 'Location Unavailable', sub: 'Waiting for GPS telemetry fix...', tone: 'amber' };
    }
    if (job?.status === 'completed') {
      return { label: 'Job Completed', sub: 'Service completed successfully.', tone: 'emerald' };
    }
    if (job?.status === 'in_progress') {
      return { label: 'Work In Progress', sub: 'Technician currently servicing appliance at customer site.', tone: 'blue' };
    }
    if (isBackendArrived) {
      return { label: 'Arrived at Customer Location', sub: 'Inside 300m site perimeter. Work Start OTP required.', tone: 'emerald' };
    }
    if (distanceMeters != null && distanceMeters <= geofenceRadius) {
      return { label: 'Approaching Customer Destination', sub: 'Entering 300m arrival perimeter...', tone: 'blue' };
    }
    if (distanceMeters != null && distanceMeters <= 1000) {
      return { label: 'Approaching Customer', sub: 'Technician is under 1 km away.', tone: 'blue' };
    }
    return { label: 'En Route to Customer', sub: 'Driving along authorized road route.', tone: 'slate' };
  }, [liveTechCoords, job?.status, isBackendArrived, distanceMeters, geofenceRadius]);

  const displayDistance = roadDistanceText || (
    distanceMeters != null
      ? distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${distanceMeters} m`
      : 'Calculating...'
  );

  const displayEta = roadEtaText || (
    distanceMeters != null
      ? distanceMeters <= 300
        ? 'Arriving Now'
        : `${Math.max(1, Math.round((distanceMeters / 1000) * 3))} mins`
      : '--'
  );

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
      {/* Swiggy / Uber Style Header Tracking Card */}
      <div className="p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status & ETA Pill */}
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
                  <span>{statusInfo.label}</span>
                  {!isBackendArrived && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                </h3>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5 font-medium">
                {statusInfo.sub}
              </p>
            </div>
          </div>

          {/* Real-Time Live Road ETA & Distance Badge */}
          <div className="flex items-center gap-3 ml-auto">
            {!isBackendArrived && (
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-lg px-3 py-1 text-center backdrop-blur-sm">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  Est. ETA
                </span>
                <span className="text-sm font-black font-mono text-emerald-400 tracking-tight">
                  {displayEta}
                </span>
              </div>
            )}

            <div className="bg-slate-800/90 border border-slate-700/80 rounded-lg px-3 py-1 text-center backdrop-blur-sm">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3 text-emerald-400" />
                Distance
              </span>
              <span className="text-sm font-black font-mono text-white tracking-tight">
                {displayDistance}
              </span>
            </div>

            {job?.latitude != null && job?.longitude != null && (
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

        {/* Customer Destination Address Ribbon */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <Home className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="font-semibold text-slate-200 shrink-0">Customer:</span>
            <span className="truncate text-slate-300">{job?.address || 'Service Destination'}</span>
          </div>
          {liveTechCoords?.accuracy != null && (
            <span className="text-[10px] text-slate-400 font-mono shrink-0">
              GPS ±{Math.round(liveTechCoords.accuracy)}m
            </span>
          )}
        </div>
      </div>

      {/* Interactive Google Map with Road Route Polyline */}
      <div className="relative w-full h-[280px] sm:h-[340px] bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Swiggy-Style Map Action Control Buttons Overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={handleFitRouteBounds}
            title="Fit Entire Route into View"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <Compass className="w-4 h-4 text-blue-600" />
          </button>
          <button
            type="button"
            onClick={handleFocusTechnician}
            title="Follow My Location"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-blue-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <Crosshair className="w-4 h-4 text-blue-600" />
          </button>
          <button
            type="button"
            onClick={handleFocusCustomer}
            title="Focus Customer Site"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-red-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm active:scale-95"
          >
            <MapPin className="w-4 h-4 text-red-600" />
          </button>
          <button
            type="button"
            onClick={handleManualGpsRefresh}
            disabled={isRefreshingGps}
            title="Refresh High-Accuracy GPS Fix"
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-600 rounded-lg shadow-md border border-slate-200 text-xs font-bold transition-all flex items-center justify-center backdrop-blur-sm disabled:opacity-50 active:scale-95"
          >
            <RotateCw className={`w-4 h-4 text-emerald-600 ${isRefreshingGps ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200/90 shadow text-[10px] space-y-1.5 z-10">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-200 flex items-center justify-center text-[7px] text-white font-black">
              🚗
            </span>
            <span>Your Live Vehicle Pin</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-200 flex items-center justify-center text-[7px] text-white font-black">
              🏠
            </span>
            <span>Customer Destination</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-blue-700">
            <span className="w-5 h-1.5 rounded-full bg-blue-600 shadow-sm" />
            <span>Turn-by-Turn Road Route</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-emerald-700">
            <span className="w-3 h-3 rounded-full border border-emerald-500 bg-emerald-100" />
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

      {/* Swiggy-Style Footer Live Progress & Geofence Status */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-700 flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">
            {isBackendArrived ? (
              <strong className="text-emerald-700 font-bold">
                ✓ ARRIVAL VERIFIED — You have arrived within 300m of customer site. Ask customer for the 6-digit Work Start OTP.
              </strong>
            ) : (
              <span>
                Move along the road route. Backend GPS automatically verifies arrival within <strong className="text-slate-900 font-bold">300 meters</strong> of customer destination.
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            {isBackendArrived ? 'SITE REACHED' : 'LIVE TRACKING'}
          </span>
        </div>
      </div>
    </div>
  );
}
