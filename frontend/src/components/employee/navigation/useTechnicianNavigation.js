/**
 * useTechnicianNavigation.js
 *
 * Dedicated Navigation State Machine Hook for CalTrack Field Technicians.
 *
 * Manages:
 *  - High-accuracy GPS telemetry reception with out-of-order packet rejection.
 *  - Google Maps Directions routing with strict 50m movement & 30s rate-limit throttling.
 *  - Active step progression and distance-to-next-turn calculation.
 *  - Off-route detection and automatic recalculation.
 *  - Dynamic driving ETA, remaining distance, and estimated arrival clock.
 *  - Follow-Mode camera state and manual pan detection.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  calculateDistanceMeters,
  calculateBearing,
  computeCrossTrackDistanceMeters,
  formatDistance,
  formatEtaMinutes,
  computeArrivalTimeClock,
} from './navigationUtils.js';
import {
  parseRouteStep,
  findActiveStepIndex,
  computeDistanceToNextManeuver,
  getUpcomingManeuverPreview,
} from './maneuverUtils.js';
import { loadMapsApi } from '../../../utils/loadGoogleMaps.js';

const MIN_ROUTING_INTERVAL_MS = 30_000; // 30 seconds minimum between Directions requests
const MIN_ROUTING_MOVEMENT_METERS = 50;  // 50 meters movement threshold
const OFF_ROUTE_THRESHOLD_METERS = 65;   // 65 meters cross-track deviation triggers recalculation

export function useTechnicianNavigation({
  job,
  initialTechnicianLocation,
  onLocationReport,
}) {
  const custLat = job?.latitude != null ? parseFloat(job.latitude) : null;
  const custLon = job?.longitude != null ? parseFloat(job.longitude) : null;

  // Real technician live coordinates
  const [technicianLocation, setTechnicianLocation] = useState(
    initialTechnicianLocation
      ? {
          latitude: parseFloat(initialTechnicianLocation.latitude),
          longitude: parseFloat(initialTechnicianLocation.longitude),
          accuracy: initialTechnicianLocation.accuracy ?? null,
          speed: initialTechnicianLocation.speed ?? null,
          heading: initialTechnicianLocation.heading ?? null,
          captured_at: initialTechnicianLocation.captured_at || initialTechnicianLocation.updated_at || new Date().toISOString(),
        }
      : null
  );

  const [heading, setHeading] = useState(initialTechnicianLocation?.heading ?? 0);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [directionsResult, setDirectionsResult] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [directionsFailed, setDirectionsFailed] = useState(false);
  const [lastUpdateSecondsAgo, setLastUpdateSecondsAgo] = useState(0);

  // Performance and throttling refs
  const lastCapturedAtRef = useRef(technicianLocation?.captured_at ? new Date(technicianLocation.captured_at).getTime() : 0);
  const lastRoutingTimeRef = useRef(0);
  const lastRoutedCoordsRef = useRef({ lat: null, lng: null });
  const prevPositionRef = useRef(technicianLocation ? { lat: technicianLocation.latitude, lng: technicianLocation.longitude } : null);
  const directionsServiceRef = useRef(null);

  // Synchronize initial technician location prop
  useEffect(() => {
    if (initialTechnicianLocation?.latitude != null && initialTechnicianLocation?.longitude != null) {
      const incomingCapturedAt = initialTechnicianLocation.captured_at || initialTechnicianLocation.updated_at;
      const incomingTime = incomingCapturedAt ? new Date(incomingCapturedAt).getTime() : Date.now();

      if (incomingTime >= lastCapturedAtRef.current) {
        lastCapturedAtRef.current = incomingTime;
        const newCoords = {
          latitude: parseFloat(initialTechnicianLocation.latitude),
          longitude: parseFloat(initialTechnicianLocation.longitude),
          accuracy: initialTechnicianLocation.accuracy ?? null,
          speed: initialTechnicianLocation.speed ?? null,
          heading: initialTechnicianLocation.heading ?? null,
          captured_at: new Date(incomingTime).toISOString(),
        };
        setTechnicianLocation(newCoords);
        if (newCoords.heading != null && !isNaN(newCoords.heading)) {
          setHeading(newCoords.heading);
        }
      }
    }
  }, [initialTechnicianLocation]);

  // Request authoritative route from Google Directions Service (Throttled)
  const requestRoadRoute = useCallback(
    (originLat, originLng, destLat, destLng, force = false) => {
      if (originLat == null || destLat == null) return;

      // Guard: Google Maps must be fully initialized with DirectionsService available
      const mapsReady = (
        typeof window !== 'undefined' &&
        window.google?.maps &&
        typeof window.google.maps.DirectionsService === 'function'
      );

      if (!mapsReady) {
        // Retry once the API finishes bootstrapping (checked every 300ms, max 10s)
        const retryStarted = Date.now();
        const retryInterval = setInterval(() => {
          if (
            typeof window.google?.maps?.DirectionsService === 'function' ||
            Date.now() - retryStarted > 10_000
          ) {
            clearInterval(retryInterval);
            if (typeof window.google?.maps?.DirectionsService === 'function') {
              requestRoadRoute(originLat, originLng, destLat, destLng, force);
            }
          }
        }, 300);
        return;
      }

      const now = Date.now();

      // Check time throttle (unless forced)
      if (!force && now - lastRoutingTimeRef.current < MIN_ROUTING_INTERVAL_MS) {
        return;
      }

      // Check distance movement threshold (unless forced)
      if (!force && lastRoutedCoordsRef.current.lat != null) {
        const movedMeters = calculateDistanceMeters(
          lastRoutedCoordsRef.current.lat,
          lastRoutedCoordsRef.current.lng,
          originLat,
          originLng
        );
        if (movedMeters != null && movedMeters < MIN_ROUTING_MOVEMENT_METERS) {
          return;
        }
      }

      if (!directionsServiceRef.current) {
        directionsServiceRef.current = new window.google.maps.DirectionsService();
      }

      lastRoutingTimeRef.current = now;
      lastRoutedCoordsRef.current = { lat: originLat, lng: originLng };
      setIsRecalculating(true);

      directionsServiceRef.current.route(
        {
          origin: new window.google.maps.LatLng(originLat, originLng),
          destination: new window.google.maps.LatLng(destLat, destLng),
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          setIsRecalculating(false);
          if (status === window.google.maps.DirectionsStatus.OK && result?.routes?.[0]?.legs?.[0]) {
            setDirectionsResult(result);
            setDirectionsFailed(false);

            const rawSteps = result.routes[0].legs[0].steps || [];
            const parsedSteps = rawSteps.map((step, idx) =>
              parseRouteStep(step, idx, idx === rawSteps.length - 1)
            );
            setRouteSteps(parsedSteps);
            setActiveStepIndex(0);
          } else {
            console.warn('[NAVIGATION_DIRECTIONS_STATUS]', status);
            setDirectionsFailed(true);
          }
        }
      );
    },
    []
  );

  // Listen to live GPS location updates from centralized watcher
  useEffect(() => {
    const handleLocationUpdate = (e) => {
      const detail = e.detail;
      if (detail?.latitude == null || detail?.longitude == null) return;

      const incomingTimestamp = detail.timestamp || Date.now();
      const incomingCapturedAt = detail.captured_at ? new Date(detail.captured_at).getTime() : incomingTimestamp;

      // ── Out-of-Order Packet Defense Invariant ──
      if (incomingCapturedAt < lastCapturedAtRef.current) {
        return; // Discard stale/delayed packet
      }
      lastCapturedAtRef.current = incomingCapturedAt;

      const lat = parseFloat(detail.latitude);
      const lng = parseFloat(detail.longitude);

      // Compute dynamic bearing if device heading is not provided
      let calculatedBearing = detail.heading;
      if (calculatedBearing == null && prevPositionRef.current) {
        const moved = calculateDistanceMeters(prevPositionRef.current.lat, prevPositionRef.current.lng, lat, lng);
        if (moved != null && moved >= 3) {
          calculatedBearing = calculateBearing(prevPositionRef.current.lat, prevPositionRef.current.lng, lat, lng);
        }
      }

      if (calculatedBearing != null && !isNaN(calculatedBearing)) {
        setHeading(calculatedBearing);
      }

      prevPositionRef.current = { lat, lng };

      const newCoords = {
        latitude: lat,
        longitude: lng,
        accuracy: detail.accuracy ?? null,
        speed: detail.speed ?? null,
        heading: calculatedBearing ?? null,
        captured_at: new Date(incomingCapturedAt).toISOString(),
      };

      setTechnicianLocation(newCoords);

      // Notify parent if callback provided
      if (onLocationReport) {
        onLocationReport(newCoords);
      }

      // Check step progression
      if (routeSteps.length > 0) {
        const nextIdx = findActiveStepIndex(routeSteps, lat, lng, activeStepIndex);
        if (nextIdx !== activeStepIndex) {
          setActiveStepIndex(nextIdx);
        }

        // Off-route check
        const activeStep = routeSteps[activeStepIndex];
        if (activeStep?.startLocation && activeStep?.endLocation) {
          const crossTrackDist = computeCrossTrackDistanceMeters(
            { lat, lng },
            activeStep.startLocation,
            activeStep.endLocation
          );
          if (crossTrackDist > OFF_ROUTE_THRESHOLD_METERS && custLat != null && custLon != null) {
            requestRoadRoute(lat, lng, custLat, custLon, true);
          }
        }
      }

      // Check if routing should be requested
      if (custLat != null && custLon != null && !directionsResult) {
        requestRoadRoute(lat, lng, custLat, custLon, true);
      } else if (custLat != null && custLon != null) {
        requestRoadRoute(lat, lng, custLat, custLon, false);
      }
    };

    window.addEventListener('workforce:location-updated', handleLocationUpdate);
    return () => {
      window.removeEventListener('workforce:location-updated', handleLocationUpdate);
    };
  }, [activeStepIndex, custLat, custLon, directionsResult, onLocationReport, requestRoadRoute, routeSteps]);

  // Load Google Maps API Script
  useEffect(() => {
    loadMapsApi()
      .then(() => {
        if (custLat != null && custLon != null && technicianLocation?.latitude != null && !directionsResult) {
          requestRoadRoute(technicianLocation.latitude, technicianLocation.longitude, custLat, custLon, true);
        }
      })
      .catch((err) => console.warn('[NAV_HOOK_MAP_LOAD_ERROR]', err));
  }, [custLat, custLon, directionsResult, requestRoadRoute, technicianLocation]);

  // Initial Route Request on mount if coordinates exist
  useEffect(() => {
    if (custLat != null && custLon != null && technicianLocation?.latitude != null && !directionsResult) {
      requestRoadRoute(technicianLocation.latitude, technicianLocation.longitude, custLat, custLon, true);
    }
  }, [custLat, custLon, directionsResult, requestRoadRoute, technicianLocation]);

  // Freshness timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (technicianLocation?.captured_at) {
        const diffSec = Math.max(0, Math.round((Date.now() - new Date(technicianLocation.captured_at).getTime()) / 1000));
        setLastUpdateSecondsAgo(diffSec);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [technicianLocation]);

  // Active maneuver step details
  const activeStep = useMemo(() => {
    if (!routeSteps || routeSteps.length === 0) return null;
    return routeSteps[activeStepIndex] || routeSteps[0];
  }, [routeSteps, activeStepIndex]);

  const upcomingPreview = useMemo(() => {
    return getUpcomingManeuverPreview(routeSteps, activeStepIndex);
  }, [routeSteps, activeStepIndex]);

  const distanceToNextManeuverMeters = useMemo(() => {
    if (!activeStep || technicianLocation?.latitude == null) return activeStep?.stepDistanceMeters ?? 0;
    return computeDistanceToNextManeuver(activeStep, technicianLocation.latitude, technicianLocation.longitude);
  }, [activeStep, technicianLocation]);

  // Total route metrics
  const totalLeg = directionsResult?.routes?.[0]?.legs?.[0];
  const totalDistanceMeters = totalLeg?.distance?.value ?? calculateDistanceMeters(
    technicianLocation?.latitude,
    technicianLocation?.longitude,
    custLat,
    custLon
  );
  const totalDurationSeconds = totalLeg?.duration?.value ?? (totalDistanceMeters ? Math.round((totalDistanceMeters / 1000) * 180) : null);

  const displayDistanceText = !directionsFailed && totalLeg?.distance?.text
    ? totalLeg.distance.text
    : formatDistance(totalDistanceMeters);

  const displayEtaText = !directionsFailed && totalLeg?.duration?.text
    ? totalLeg.duration.text
    : formatEtaMinutes(totalDurationSeconds);

  const arrivalClockText = useMemo(() => {
    return computeArrivalTimeClock(totalDurationSeconds);
  }, [totalDurationSeconds]);

  // Telemetry status badge
  const telemetryStatus = useMemo(() => {
    if (!technicianLocation?.captured_at) return { label: 'ACQUIRING GPS', tone: 'amber' };
    if (lastUpdateSecondsAgo <= 5) return { label: 'LIVE', tone: 'emerald' };
    if (lastUpdateSecondsAgo <= 15) return { label: 'UPDATING', tone: 'blue' };
    if (lastUpdateSecondsAgo <= 30) return { label: 'DELAYED', tone: 'amber' };
    return { label: 'LOCATION LOST', tone: 'rose' };
  }, [lastUpdateSecondsAgo, technicianLocation]);

  // Resume Navigation Follow Mode
  const handleResumeNavigation = useCallback(() => {
    setIsFollowMode(true);
  }, []);

  return {
    technicianLocation,
    heading,
    custLat,
    custLon,
    directionsResult,
    routeSteps,
    activeStep,
    activeStepIndex,
    upcomingPreview,
    distanceToNextManeuverMeters,
    distanceToNextManeuverText: formatDistance(distanceToNextManeuverMeters),
    totalDistanceMeters,
    displayDistanceText,
    displayEtaText,
    arrivalClockText,
    isFollowMode,
    setIsFollowMode,
    handleResumeNavigation,
    isRecalculating,
    directionsFailed,
    telemetryStatus,
    lastUpdateSecondsAgo,
    requestRoadRoute,
  };
}
