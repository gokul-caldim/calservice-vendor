/**
 * TechnicianFirstPersonMap.jsx
 *
 * True First-Person Course-Up Navigation Map for CalTrack Technicians.
 * Matches Google Maps Navigation experience with:
 *  - Course-Up Bearing Rotation following real device GPS movement heading.
 *  - Navigation Camera Offset (technician situated in lower 25% of viewport).
 *  - Smooth 60fps requestAnimationFrame position & heading interpolation.
 *  - Speedometer dial (km/h from device GPS).
 *  - Magnetic compass rose with North-pointing needle (Course-Up / North-Up toggle).
 *  - Follow-Mode auto-tracking with 1-click Resume Navigation.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { loadMapsApi } from '../../../utils/loadGoogleMaps.js';
import { createNavigationPuckIcon } from './navigationPuckMarker.js';
import { formatSpeedKmh, calculateCompassRotation, interpolateShortestAngle } from './speedAndCompassUtils.js';
import { interpolatePosition } from './navigationUtils.js';

const ANIMATION_DURATION_MS = 900; // 900ms smooth gliding interpolation between GPS fixes

export function TechnicianFirstPersonMap({
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
  isCourseUp = true,
  onToggleCourseUp,
  isFullscreen = false,
  geofenceRadius = 250,
  className = 'w-full h-full min-h-[380px]',
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const puckMarkerRef = useRef(null);
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
  const [isMuted, setIsMuted] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  // Load Google Maps API Script
  useEffect(() => {
    if (!apiKey) return;
    loadMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch((err) => console.warn('[NAV_MAP_LOAD_ERROR]', err));
  }, [apiKey]);

  // Compute forward-looking navigation camera center (offsets ~35m behind vehicle along heading vector)
  const computeNavigationCenter = useCallback((lat, lng, headingDeg = 0, zoom = 18.5) => {
    if (!mapRef.current || lat == null || lng == null) return { lat, lng };

    const offsetDistanceMeters = 38; // Places vehicle in lower 25% of viewport
    const earthRadius = 6371000;
    const headingRad = ((headingDeg || 0) * Math.PI) / 180;

    // Move backward (opposite of heading vector)
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
        zoom: 18,
        tilt: 45, // Perspective navigation tilt
        heading: isCourseUp ? heading : 0,
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

      // Pause follow mode on user manual drag or zoom gesture
      map.addListener('dragstart', () => {
        if (onFollowModeChange) onFollowModeChange(false);
      });
      // Track whether the next zoom_changed is user-initiated (not from our camera code)
      let userZoomPending = false;
      map.addListener('mousedown', () => { userZoomPending = true; });
      map.addListener('touchstart', () => { userZoomPending = true; }, { passive: true });
      map.addListener('zoom_changed', () => {
        if (userZoomPending) {
          userZoomPending = false;
          if (onFollowModeChange) onFollowModeChange(false);
        }
      });
      map.addListener('dragend', () => { userZoomPending = false; });

      // Directions Renderer
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // Use custom puck & customer pins
        preserveViewport: true, // Keep navigation camera in control
        polylineOptions: {
          strokeColor: '#2563EB', // Electric Blue road route
          strokeWeight: 7,
          strokeOpacity: 0.94,
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

      // 3. Technician Navigation Puck Marker
      if (technicianLocation?.latitude != null && technicianLocation?.longitude != null) {
        const techPos = { lat: technicianLocation.latitude, lng: technicianLocation.longitude };
        currentPosRef.current = techPos;
        targetPosRef.current = techPos;
        currentHeadingRef.current = heading;

        const puckMarker = new google.maps.Marker({
          position: techPos,
          map,
          title: 'You (Technician)',
          icon: createNavigationPuckIcon(heading, 56),
          zIndex: 300,
        });
        puckMarkerRef.current = puckMarker;

        // Position initial camera
        const navCenter = computeNavigationCenter(techPos.lat, techPos.lng, heading, 18);
        map.setCenter(navCenter);
      }

      setMapReady(true);
    } catch (err) {
      console.warn('[NAV_MAP_INIT_ERROR]', err);
    }
  }, [apiLoaded, computeNavigationCenter, custLat, custLon, geofenceRadius, heading, isCourseUp, job, onFollowModeChange, technicianLocation]);

  // Synchronize Google Directions Result onto map
  useEffect(() => {
    if (directionsRendererRef.current && directionsResult) {
      directionsRendererRef.current.setDirections(directionsResult);
    }
  }, [directionsResult]);

  // Respond to cameraMode, isFullscreen, or isCourseUp changes
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const google = window.google;

    // Trigger map resize on fullscreen transition
    setTimeout(() => {
      if (mapRef.current) {
        google.maps.event.trigger(mapRef.current, 'resize');
        if (cameraMode === 'driving' && currentPosRef.current) {
          mapRef.current.setTilt(45);
          mapRef.current.setZoom(18.5);
          if (typeof mapRef.current.setHeading === 'function') {
            mapRef.current.setHeading(isCourseUp ? currentHeadingRef.current : 0);
          }
          const navCenter = computeNavigationCenter(
            currentPosRef.current.lat,
            currentPosRef.current.lng,
            isCourseUp ? currentHeadingRef.current : 0,
            18.5
          );
          mapRef.current.panTo(navCenter);
        } else if (cameraMode === 'overview' && custLat != null && currentPosRef.current) {
          mapRef.current.setTilt(0);
          if (typeof mapRef.current.setHeading === 'function') {
            mapRef.current.setHeading(0);
          }
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: custLat, lng: custLon });
          bounds.extend(currentPosRef.current);
          mapRef.current.fitBounds(bounds, { top: 120, right: 60, bottom: 120, left: 60 });
        }
      }
    }, 100);
  }, [cameraMode, computeNavigationCenter, custLat, custLon, isCourseUp, isFullscreen]);

  // Smooth 60fps Bike/Puck Animation loop using requestAnimationFrame
  const animateStep = useCallback((timestamp) => {
    if (!animStartTimeRef.current) animStartTimeRef.current = timestamp;
    const elapsed = timestamp - animStartTimeRef.current;
    const progress = Math.min(1, elapsed / ANIMATION_DURATION_MS);

    if (startPosRef.current && targetPosRef.current) {
      const interpolatedPos = interpolatePosition(startPosRef.current, targetPosRef.current, progress);
      const interpolatedHeading = interpolateShortestAngle(currentHeadingRef.current, targetHeadingRef.current, progress);

      currentPosRef.current = interpolatedPos;

      if (puckMarkerRef.current && window.google?.maps) {
        puckMarkerRef.current.setPosition(new window.google.maps.LatLng(interpolatedPos.lat, interpolatedPos.lng));
        puckMarkerRef.current.setIcon(createNavigationPuckIcon(interpolatedHeading, 56));
      }

      // Smooth camera follow in driving mode
      if (isFollowMode && cameraMode === 'driving' && mapRef.current) {
        if (isCourseUp && typeof mapRef.current.setHeading === 'function') {
          mapRef.current.setHeading(interpolatedHeading);
        }
        const navCenter = computeNavigationCenter(
          interpolatedPos.lat,
          interpolatedPos.lng,
          isCourseUp ? interpolatedHeading : 0,
          18.5
        );
        mapRef.current.panTo(navCenter);
      }
    }

    if (progress < 1) {
      animFrameRef.current = requestAnimationFrame(animateStep);
    } else {
      currentHeadingRef.current = targetHeadingRef.current;
      animStartTimeRef.current = 0;
    }
  }, [cameraMode, computeNavigationCenter, isCourseUp, isFollowMode]);

  // Trigger animation whenever incoming GPS coordinates or heading change
  useEffect(() => {
    if (!mapReady || technicianLocation?.latitude == null || technicianLocation?.longitude == null) return;
    const newTarget = { lat: technicianLocation.latitude, lng: technicianLocation.longitude };

    targetHeadingRef.current = heading ?? currentHeadingRef.current;

    if (!currentPosRef.current) {
      currentPosRef.current = newTarget;
      startPosRef.current = newTarget;
      targetPosRef.current = newTarget;
      if (puckMarkerRef.current) {
        puckMarkerRef.current.setPosition(new window.google.maps.LatLng(newTarget.lat, newTarget.lng));
        puckMarkerRef.current.setIcon(createNavigationPuckIcon(targetHeadingRef.current, 56));
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
      mapRef.current.setTilt(45);
      mapRef.current.setZoom(18.5);
      if (isCourseUp && typeof mapRef.current.setHeading === 'function') {
        mapRef.current.setHeading(currentHeadingRef.current);
      }
      const navCenter = computeNavigationCenter(
        currentPosRef.current.lat,
        currentPosRef.current.lng,
        isCourseUp ? currentHeadingRef.current : 0,
        18.5
      );
      mapRef.current.panTo(navCenter);
    }
  };

  // Switch between Course-Up and North-Up
  const handleToggleNorthUp = () => {
    if (onToggleCourseUp) {
      onToggleCourseUp();
    } else {
      if (mapRef.current && typeof mapRef.current.setHeading === 'function') {
        mapRef.current.setHeading(0);
      }
    }
  };

  // Speed calculation from device GPS
  const speedObj = formatSpeedKmh(technicianLocation?.speed);
  const compassNeedleRotation = calculateCompassRotation(isCourseUp ? (heading || 0) : 0);

  return (
    <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-full" />

      {/* ── 1. Floating Speedometer Dial (Bottom-Left) ── */}
      <div className="absolute left-4 bottom-6 z-20">
        <div className="w-16 h-16 rounded-full bg-white/95 backdrop-blur-md shadow-2xl border-2 border-slate-200 flex flex-col items-center justify-center text-slate-900 select-none">
          <span className="text-xl font-black leading-none tracking-tight">
            {speedObj.text}
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">
            km/h
          </span>
        </div>
      </div>

      {/* ── 2. Floating Action Controls Column (Right Side) ── */}
      <div className="absolute right-4 bottom-6 z-20 flex flex-col items-center gap-3">
        {/* Compass Rose Widget (North needle) */}
        <button
          type="button"
          onClick={handleToggleNorthUp}
          title={isCourseUp ? 'Switch to North-Up' : 'Switch to Course-Up'}
          className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <div
            className="transition-transform duration-300 ease-out flex items-center justify-center"
            style={{ transform: `rotate(${compassNeedleRotation}deg)` }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              {/* North Red Pointer */}
              <polygon points="14,3 18,14 14,12 10,14" fill="#EF4444" />
              {/* South White/Slate Pointer */}
              <polygon points="14,25 18,14 14,12 10,14" fill="#94A3B8" />
              <circle cx="14" cy="13" r="1.5" fill="#334155" />
            </svg>
          </div>
        </button>

        {/* Search / Landmark button */}
        <button
          type="button"
          onClick={() => {}}
          title="Search along route"
          className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Search className="w-5 h-5 text-slate-700" />
        </button>

        {/* Audio Mute / Unmute Button */}
        <button
          type="button"
          onClick={() => setIsMuted((prev) => !prev)}
          title={isMuted ? 'Unmute Guidance' : 'Mute Guidance'}
          className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-slate-500" /> : <Volume2 className="w-5 h-5 text-slate-700" />}
        </button>

        {/* Report / Hazard Button */}
        <button
          type="button"
          onClick={() => {}}
          title="Report Hazard"
          className="flex items-center gap-1 px-3 py-2 rounded-full bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 text-slate-800 text-xs font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <div className="p-1 rounded-full bg-amber-500/10 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span>Report</span>
        </button>
      </div>

      {/* ── 3. Recenter / Follow Button (appears only when follow mode is off) ── */}
      {(!isFollowMode || cameraMode === 'overview') && (
        <div
          className="absolute right-4 z-30 animate-[scalein_0.18s_ease-out]"
          style={{ bottom: 'calc(1.5rem + 232px)' /* sits 8px above the controls column */ }}
        >
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter on my location"
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xl border-2 border-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
          >
            {/* GPS target / crosshair icon */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── 4. Real GPS Accuracy Indicator ── */}
      {technicianLocation?.accuracy != null && (
        <div className="absolute left-4 top-4 z-10 px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>GPS ±{Math.round(technicianLocation.accuracy)}m</span>
        </div>
      )}
    </div>
  );
}
