/**
 * LocationPickerMap.jsx
 *
 * Reusable Google Maps-based location picker component.
 * Used by both:
 *   - Employee Saved Locations (personal)
 *   - Admin Authorized Locations (company geofence)
 *
 * Features:
 *   - Loads Maps JavaScript API dynamically (key from VITE_GOOGLE_MAPS_KEY)
 *   - Draggable marker at current coordinates
 *   - "Use Current Location" button (real GPS only)
 *   - Address search via Places Autocomplete
 *   - Calls onPositionChange(lat, lng) on any coordinate change
 *   - Optional geofenceRadius (metres) shown as a circle overlay (admin use)
 *
 * No mock coordinates. No hardcoded API keys.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Search, Loader } from 'lucide-react';
import { getGPSPosition } from '../../hooks/useGPSPosition.js';

import { loadMapsApi } from '../../utils/loadGoogleMaps.js';

/**
 * @param {Object} props
 * @param {number|null} props.latitude       - Initial latitude (may be null)
 * @param {number|null} props.longitude      - Initial longitude (may be null)
 * @param {function} props.onPositionChange  - Called with (lat, lng) on pin move/click/GPS
 * @param {number} [props.geofenceRadius]    - If set, draws a circle overlay (admin mode)
 * @param {boolean} [props.showSearch]       - Show Places Autocomplete input (default true)
 * @param {string} [props.height]            - CSS height of the map container (default '280px')
 */
export function LocationPickerMap({
  latitude,
  longitude,
  onPositionChange,
  geofenceRadius,
  showSearch = true,
  height = '280px',
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);

  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  // Default centre: India if no coords provided
  const defaultLat = latitude ?? 20.5937;
  const defaultLng = longitude ?? 78.9629;
  const defaultZoom = latitude != null ? 15 : 5;

  // Update circle radius when geofenceRadius prop changes
  useEffect(() => {
    if (circleRef.current && geofenceRadius != null) {
      circleRef.current.setRadius(geofenceRadius);
    }
  }, [geofenceRadius]);

  // Load the Maps API
  useEffect(() => {
    if (!apiKey) {
      setApiError('Google Maps API key is not configured (VITE_GOOGLE_MAPS_KEY missing).');
      return;
    }
    loadMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch(() => setApiError('Failed to load Google Maps. Check your API key and network.'));
  }, [apiKey]);

  // Initialise the map once the API is loaded and container is ready
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current) return;
    const google = window.google;
    if (!google?.maps?.Map || !google?.maps?.ControlPosition) return;

    try {
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: defaultZoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
      mapRef.current = map;

      // Draggable marker
      const marker = new google.maps.Marker({
        position: { lat: defaultLat, lng: defaultLng },
        map,
        draggable: true,
        title: 'Drag to set location',
        visible: latitude != null,
      });
      markerRef.current = marker;

      // Geofence circle (admin mode)
      if (geofenceRadius != null) {
        const circle = new google.maps.Circle({
          map,
          center: marker.getPosition(),
          radius: geofenceRadius,
          strokeColor: '#2563EB',
          strokeOpacity: 0.6,
          strokeWeight: 2,
          fillColor: '#3B82F6',
          fillOpacity: 0.1,
        });
        circleRef.current = circle;
      }

      // Map click → place marker
      const clickListener = map.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        marker.setPosition({ lat, lng });
        marker.setVisible(true);
        if (circleRef.current) circleRef.current.setCenter({ lat, lng });
        onPositionChange(lat, lng);
      });

      // Marker drag end
      const dragListener = marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        const lat = pos.lat();
        const lng = pos.lng();
        if (circleRef.current) circleRef.current.setCenter({ lat, lng });
        onPositionChange(lat, lng);
      });

      // Places Autocomplete
      let placeListener = null;
      if (showSearch && searchInputRef.current && google.maps.places) {
        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['geometry', 'formatted_address'],
        });
        placeListener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          map.setCenter({ lat, lng });
          map.setZoom(16);
          marker.setPosition({ lat, lng });
          marker.setVisible(true);
          if (circleRef.current) circleRef.current.setCenter({ lat, lng });
          onPositionChange(lat, lng);
        });
        autocompleteRef.current = autocomplete;
      }

      return () => {
        if (clickListener && google?.maps?.event) google.maps.event.removeListener(clickListener);
        if (dragListener && google?.maps?.event) google.maps.event.removeListener(dragListener);
        if (placeListener && google?.maps?.event) google.maps.event.removeListener(placeListener);
      };
    } catch (err) {
      console.error('Error initializing map:', err);
      setApiError('Failed to initialize map display. Please refresh.');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded]);

  // Sync marker position when parent passes new lat/lng
  useEffect(() => {
    if (!markerRef.current || latitude == null || longitude == null) return;
    const pos = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
    markerRef.current.setPosition(pos);
    markerRef.current.setVisible(true);
    if (circleRef.current) circleRef.current.setCenter(pos);
    if (mapRef.current) mapRef.current.panTo(pos);
  }, [latitude, longitude]);

  const handleUseCurrentLocation = useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const pos = await getGPSPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (mapRef.current) {
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(16);
      }
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
        markerRef.current.setVisible(true);
      }
      if (circleRef.current) circleRef.current.setCenter({ lat, lng });
      onPositionChange(lat, lng);
    } catch (err) {
      setGpsError(
        err.code === 'PERMISSION_DENIED'
          ? 'Location access denied. Please allow browser location permissions.'
          : 'Could not obtain GPS position. Try again.',
      );
    } finally {
      setGpsLoading(false);
    }
  }, [onPositionChange]);

  return (
    <div className="space-y-2">
      {/* Search bar */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search address or place…"
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            disabled={!apiLoaded}
          />
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded border border-slate-200 overflow-hidden" style={{ height }}>
        {!apiLoaded && !apiError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Loading map…</span>
            </div>
          </div>
        )}
        {apiError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 p-4">
            <div className="text-center">
              <MapPin className="w-6 h-6 text-rose-400 mx-auto mb-1" />
              <p className="text-xs text-rose-600 font-medium">{apiError}</p>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading || !apiLoaded}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {gpsLoading ? (
            <Loader className="w-3 h-3 animate-spin" />
          ) : (
            <Navigation className="w-3 h-3 text-blue-500" />
          )}
          {gpsLoading ? 'Getting GPS…' : 'Use Current Location'}
        </button>

        {latitude != null && longitude != null && (
          <span className="text-[10px] font-mono text-slate-500">
            {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
          </span>
        )}
      </div>

      {gpsError && (
        <p className="text-xs text-rose-600 font-medium">{gpsError}</p>
      )}
    </div>
  );
}

export default LocationPickerMap;
