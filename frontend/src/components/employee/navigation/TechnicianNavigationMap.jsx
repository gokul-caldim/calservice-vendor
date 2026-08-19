/**
 * TechnicianNavigationMap.jsx
 *
 * Dedicated Google-Maps-Style Live Navigation Map for CalTrack Field Technicians.
 *
 * Features:
 *  - 60fps requestAnimationFrame motorcycle position & heading interpolation.
 *  - Forward-looking navigation camera (technician positioned in lower-middle viewport).
 *  - Real-time road route polyline from Google Directions API.
 *  - Custom Service Motorcycle marker with transparent background & live glow.
 *  - Vivid Red Customer Home destination marker with address popup.
 *  - Translucent 300m Emerald arrival geofence perimeter.
 *  - Follow Mode with interactive drag detection & floating "Resume Navigation" control.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Compass,
  Navigation,
  Crosshair,
  MapPin,
  RotateCw,
  Zap,
} from 'lucide-react';
import { createBikeMarkerIcon } from './bikeMarker.js';
import { interpolatePosition, interpolateAngle } from './navigationUtils.js';
import { loadMapsApi } from '../../../utils/loadGoogleMaps.js';

const ANIMATION_DURATION_MS = 900; // 900ms smooth gliding interpolation between GPS fixes

export function TechnicianNavigationMap({
  job,
  technicianLocation,
  heading = 0,
  custLat,
  custLon,
  directionsResult,
  cameraMode = 'driving', // 'driving' or 'overview'
  onCameraModeChange,
  isFollowMode = true,
  onFollowModeChange,
  isFullscreen = false,
  geofenceRadius = 250,
  className = 'w-full h-full min-h-[380px]',
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const bikeMarkerRef = useRef(null);
  const custMarkerRef = useRef(null);
  const geofenceCircleRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const infoWindowRef = useRef(null);

  // Animation refs
  const animFrameRef = useRef(null);
  const animStartTimeRef = useRef(0);
  const startPosRef = useRef(null);
  const targetPosRef = useRef(null);
  const currentPosRef = useRef(null);
  const currentHeadingRef = useRef(heading);
  const targetHeadingRef = useRef(heading);

  const [apiLoaded, setApiLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  // Load Google Maps API Script
  useEffect(() => {
    if (!apiKey) return;
    loadMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch((err) => console.warn('[NAV_MAP_LOAD_ERROR]', err));
  }, [apiKey]);

  // Compute forward-looking navigation camera center (offsets behind the bike along heading vector)
  const computeNavigationCenter = useCallback((lat, lng, headingDeg = 0, zoom = 18.5) => {
    if (!mapRef.current || lat == null || lng == null) return { lat, lng };

    // In driving mode, offset camera center ~35 meters behind the bike along its heading
    // so the motorcycle stays at the lower 25% of the screen with forward road ahead visible
    const offsetDistanceMeters = 35;
    const earthRadius = 6371000;
    const headingRad = ((headingDeg || 0) * Math.PI) / 180;

    // Move backward (opposite of heading)
    const deltaLat = (-offsetDistanceMeters * Math.cos(headingRad)) / earthRadius * (180 / Math.PI);
    const deltaLng = (-offsetDistanceMeters * Math.sin(headingRad)) / (earthRadius * Math.cos((lat * Math.PI) / 180)) * (180 / Math.PI);

    return {
      lat: lat + deltaLat,
      lng: lng + deltaLng,
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current || mapRef.current) return;
    if (!window.google?.maps?.Map) return;

    try {
      const google = window.google;
      const initialLat = technicianLocation?.latitude ?? custLat ?? 12.9716;
      const initialLng = technicianLocation?.longitude ?? custLon ?? 77.5946;

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: 17,
        tilt: 45, // Perspective navigation tilt
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false, // Clean navigation canvas
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      });

      mapRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      // Pause follow mode on user manual drag
      map.addListener('dragstart', () => {
        if (onFollowModeChange) onFollowModeChange(false);
      });

      // Directions Renderer
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // Use custom bike & customer pins
        preserveViewport: true, // Keep navigation camera in control
        polylineOptions: {
          strokeColor: '#2563EB', // Electric Blue road route
          strokeWeight: 6,
          strokeOpacity: 0.92,
        },
      });
      directionsRendererRef.current = directionsRenderer;

      // 1. Customer Destination Marker
      if (custLat != null && custLon != null) {
        const custPos = { lat: custLat, lng: custLon };

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
          title: `Customer Site: ${job?.address || 'Destination'}`,
          icon: customerPinSvg,
          zIndex: 100,
        });
        custMarkerRef.current = custMarker;

        custMarker.addListener('click', () => {
          const content = `
            <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 240px;">
              <div style="background: #FEE2E2; color: #991B1B; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                CUSTOMER DESTINATION
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 2px;">
                ${job?.customer_name || 'Customer Site'}
              </div>
              <div style="font-size: 11px; color: #64748B; margin-bottom: 4px;">
                ${job?.address || 'Authorized Service Address'}
              </div>
              <div style="font-size: 10px; color: #10B981; font-weight: 700;">
                300m Arrival Geofence Active
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, custMarker);
        });

        // 2. Geofence Circle
        const circle = new google.maps.Circle({
          map,
          center: custPos,
          radius: geofenceRadius,
          strokeColor: '#10B981',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#10B981',
          fillOpacity: 0.12,
          zIndex: 10,
        });
        geofenceCircleRef.current = circle;
      }

      // 3. Technician Service Motorcycle Marker
      if (technicianLocation?.latitude != null && technicianLocation?.longitude != null) {
        const techPos = { lat: technicianLocation.latitude, lng: technicianLocation.longitude };
        currentPosRef.current = techPos;
        targetPosRef.current = techPos;
        currentHeadingRef.current = heading;

        const bikeMarker = new google.maps.Marker({
          position: techPos,
          map,
          title: 'You (Technician)',
          icon: createBikeMarkerIcon(heading, 56),
          zIndex: 300,
        });
        bikeMarkerRef.current = bikeMarker;

        // Position initial camera
        const navCenter = computeNavigationCenter(techPos.lat, techPos.lng, 17);
        map.setCenter(navCenter);
      }

      setMapReady(true);
    } catch (err) {
      console.warn('[NAV_MAP_INIT_ERROR]', err);
    }
  }, [apiLoaded, computeNavigationCenter, custLat, custLon, geofenceRadius, heading, job, onFollowModeChange, technicianLocation]);

  // Synchronize Google Directions Result onto map
  useEffect(() => {
    if (directionsRendererRef.current && directionsResult) {
      directionsRendererRef.current.setDirections(directionsResult);
    }
  }, [directionsResult]);

  // Respond to cameraMode or isFullscreen changes
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const google = window.google;

    // Trigger map resize on fullscreen transition
    setTimeout(() => {
      if (mapRef.current) {
        google.maps.event.trigger(mapRef.current, 'resize');
        if (cameraMode === 'driving' && currentPosRef.current) {
          mapRef.current.setTilt(55);
          mapRef.current.setZoom(18);
          const navCenter = computeNavigationCenter(
            currentPosRef.current.lat,
            currentPosRef.current.lng,
            currentHeadingRef.current,
            18
          );
          mapRef.current.panTo(navCenter);
        } else if (cameraMode === 'overview' && custLat != null && currentPosRef.current) {
          mapRef.current.setTilt(0);
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: custLat, lng: custLon });
          bounds.extend(currentPosRef.current);
          mapRef.current.fitBounds(bounds, { top: 100, right: 50, bottom: 100, left: 50 });
        }
      }
    }, 100);
  }, [cameraMode, computeNavigationCenter, custLat, custLon, isFullscreen]);

  // Smooth 60fps Bike Animation loop using requestAnimationFrame
  const animateStep = useCallback((timestamp) => {
    if (!animStartTimeRef.current) animStartTimeRef.current = timestamp;
    const elapsed = timestamp - animStartTimeRef.current;
    const progress = Math.min(1, elapsed / ANIMATION_DURATION_MS);

    if (startPosRef.current && targetPosRef.current) {
      const interpolatedPos = interpolatePosition(startPosRef.current, targetPosRef.current, progress);
      const interpolatedHeading = interpolateAngle(currentHeadingRef.current, targetHeadingRef.current, progress);

      currentPosRef.current = interpolatedPos;

      if (bikeMarkerRef.current && window.google?.maps) {
        bikeMarkerRef.current.setPosition(new window.google.maps.LatLng(interpolatedPos.lat, interpolatedPos.lng));
        bikeMarkerRef.current.setIcon(createBikeMarkerIcon(interpolatedHeading, 56));
      }

      // Smooth camera follow in driving mode
      if (isFollowMode && cameraMode === 'driving' && mapRef.current) {
        const navCenter = computeNavigationCenter(interpolatedPos.lat, interpolatedPos.lng, interpolatedHeading, 18);
        mapRef.current.panTo(navCenter);
      }
    }

    if (progress < 1) {
      animFrameRef.current = requestAnimationFrame(animateStep);
    } else {
      currentHeadingRef.current = targetHeadingRef.current;
      animStartTimeRef.current = 0;
    }
  }, [cameraMode, computeNavigationCenter, isFollowMode]);

  // Trigger animation whenever incoming GPS coordinates or heading change
  useEffect(() => {
    if (!mapReady || technicianLocation?.latitude == null || technicianLocation?.longitude == null) return;
    const newTarget = { lat: technicianLocation.latitude, lng: technicianLocation.longitude };

    targetHeadingRef.current = heading ?? currentHeadingRef.current;

    if (!currentPosRef.current) {
      currentPosRef.current = newTarget;
      startPosRef.current = newTarget;
      targetPosRef.current = newTarget;
      if (bikeMarkerRef.current) {
        bikeMarkerRef.current.setPosition(new window.google.maps.LatLng(newTarget.lat, newTarget.lng));
        bikeMarkerRef.current.setIcon(createBikeMarkerIcon(targetHeadingRef.current, 56));
      }
      return;
    }

    startPosRef.current = { ...currentPosRef.current };
    targetPosRef.current = newTarget;
    animStartTimeRef.current = 0;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animateStep);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animateStep, heading, mapReady, technicianLocation]);

  // Manual Recentering / Resume Follow in Driving View
  const handleRecenter = () => {
    if (onFollowModeChange) onFollowModeChange(true);
    if (onCameraModeChange) onCameraModeChange('driving');
    if (mapRef.current && currentPosRef.current) {
      mapRef.current.setTilt(55);
      mapRef.current.setZoom(18);
      const navCenter = computeNavigationCenter(
        currentPosRef.current.lat,
        currentPosRef.current.lng,
        currentHeadingRef.current,
        18
      );
      mapRef.current.panTo(navCenter);
    }
  };

  // Switch to Route Overview
  const handleToggleOverview = () => {
    if (cameraMode === 'driving') {
      if (onCameraModeChange) onCameraModeChange('overview');
      if (onFollowModeChange) onFollowModeChange(false);
      if (mapRef.current && window.google?.maps && custLat != null && currentPosRef.current) {
        mapRef.current.setTilt(0);
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: custLat, lng: custLon });
        bounds.extend(currentPosRef.current);
        mapRef.current.fitBounds(bounds, { top: 100, right: 50, bottom: 100, left: 50 });
      }
    } else {
      handleRecenter();
    }
  };

  return (
    <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: isFullscreen ? '100%' : '380px' }} />

      {/* Floating Controls Overlay (Top Right) */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        {/* Driving View vs Overview Mode Switcher */}
        <button
          type="button"
          onClick={handleToggleOverview}
          title={cameraMode === 'driving' ? 'Switch to Full Route Overview' : 'Switch to 3D Driving View'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full shadow-xl bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer backdrop-blur-xs"
        >
          {cameraMode === 'driving' ? (
            <>
              <Crosshair className="w-3.5 h-3.5 text-blue-400" />
              <span>Route Overview</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5 text-emerald-400 rotate-45" />
              <span>3D Driving View</span>
            </>
          )}
        </button>

        {/* Recenter on Motorcycle Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter Driving Camera"
          className={`p-2.5 rounded-full shadow-lg border transition-all cursor-pointer self-end ${
            isFollowMode && cameraMode === 'driving'
              ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-300/40'
              : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Navigation className={`w-4 h-4 ${isFollowMode ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* Floating "Resume Navigation" Banner when user manually panned */}
      {(!isFollowMode || cameraMode === 'overview') && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <button
            type="button"
            onClick={handleRecenter}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-xl border border-blue-400 cursor-pointer transition-all"
          >
            <Navigation className="w-3.5 h-3.5 rotate-45" />
            <span>Resume Driving View</span>
          </button>
        </div>
      )}

      {/* Accuracy Tag */}
      {technicianLocation?.accuracy != null && (
        <div className="absolute left-3 bottom-3 z-10 px-2 py-1 bg-slate-900/80 backdrop-blur-xs text-white/90 text-[10px] font-medium rounded border border-white/10 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>GPS ±{Math.round(technicianLocation.accuracy)}m</span>
        </div>
      )}
    </div>
  );
}
