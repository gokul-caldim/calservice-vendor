/**
 * TechnicianArrivalView.jsx
 *
 * Contextual Arrival & Site Location View for CalTrack Field Technicians.
 * Renders when job status is 'arrived' (or arrival geofence is verified).
 *
 *  - Clean 2D contextual map centered on customer destination
 *  - Authorized 300m green geofence circle
 *  - Customer destination marker & technician current location marker
 *  - Direct [ 📞 Call Customer ] quick action
 *  - Hides active travel navigation, maneuver cards, speedometers, and ETA countdowns.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { loadMapsApi } from '../../../utils/loadGoogleMaps.js';

export function TechnicianArrivalView({
  job,
  technicianLocation,
  geofenceRadius = 250,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  const custLat = job?.latitude != null ? parseFloat(job.latitude) : null;
  const custLon = job?.longitude != null ? parseFloat(job.longitude) : null;
  const techLat = technicianLocation?.latitude != null ? parseFloat(technicianLocation.latitude) : null;
  const techLon = technicianLocation?.longitude != null ? parseFloat(technicianLocation.longitude) : null;

  const customerName = job?.customer_name || 'Customer';
  const customerPhone = job?.phone || job?.customer_phone;
  const customerAddress = job?.address || job?.customer_address || 'Customer Authorized Address';

  // Load Google Maps API singleton
  useEffect(() => {
    let mounted = true;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    loadMapsApi(apiKey)
      .then(() => {
        if (mounted) setApiLoaded(true);
      })
      .catch((err) => console.error('[ARRIVAL_MAP_LOAD_ERROR]', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize contextual arrival map
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current || mapRef.current) return;
    if (!window.google?.maps?.Map) return;

    try {
      const google = window.google;
      const centerLat = custLat ?? techLat ?? 12.9716;
      const centerLng = custLon ?? techLon ?? 77.5946;

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 17,
        tilt: 0,
        heading: 0,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      });

      mapRef.current = map;

      // 1. Customer Destination Marker
      if (custLat != null && custLon != null) {
        const custPos = { lat: custLat, lng: custLon };

        new google.maps.Marker({
          position: custPos,
          map,
          title: `Customer Site: ${customerAddress}`,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
                  </filter>
                </defs>
                <g filter="url(#shadow)">
                  <path d="M20 0C9 0 0 9 0 20c0 14 18 27 19 28a1.5 1.5 0 0 0 2 0C22 47 40 34 40 20 40 9 31 0 20 0z" fill="#DC2626" stroke="#FFFFFF" stroke-width="2"/>
                  <circle cx="20" cy="18" r="11" fill="#FFFFFF"/>
                  <path d="M20 11l-6 5v7h4v-4h4v4h4v-7l-6-5z" fill="#DC2626"/>
                </g>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(36, 44),
            anchor: new google.maps.Point(18, 44),
          },
        });

        // 2. Verified 300m Green Geofence Circle
        new google.maps.Circle({
          map,
          center: custPos,
          radius: geofenceRadius,
          strokeColor: '#059669',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#10B981',
          fillOpacity: 0.15,
        });
      }

      // 3. Technician Location Marker
      if (techLat != null && techLon != null) {
        new google.maps.Marker({
          position: { lat: techLat, lng: techLon },
          map,
          title: 'Your Location',
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="#2563EB" stroke="#FFFFFF" stroke-width="3"/>
                <circle cx="16" cy="16" r="5" fill="#FFFFFF"/>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(28, 28),
            anchor: new google.maps.Point(14, 14),
          },
        });
      }

      // Fit bounds to show both customer site and technician
      if (custLat != null && techLat != null) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: custLat, lng: custLon });
        bounds.extend({ lat: techLat, lng: techLon });
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    } catch (err) {
      console.error('[ARRIVAL_MAP_INIT_ERROR]', err);
    }
  }, [apiLoaded, custLat, custLon, customerAddress, geofenceRadius, techLat, techLon]);

  return (
    <div className="w-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
      {/* ── Top Arrival Banner ── */}
      <div className="px-4 py-3 bg-emerald-600 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/80 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-emerald-50 flex items-center gap-1.5">
              <span>Arrival Verified</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-700/80 rounded font-semibold text-emerald-100">
                Inside {geofenceRadius}m Geofence
              </span>
            </div>
            <div className="text-xs text-emerald-100 truncate">
              You are at the customer location. Proceed with Work Start verification below.
            </div>
          </div>
        </div>

        {customerPhone && (
          <a
            href={`tel:${customerPhone}`}
            className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Call</span>
          </a>
        )}
      </div>

      {/* ── Contextual Location Map ── */}
      <div className="w-full h-[180px] sm:h-[220px] bg-slate-100 relative">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* ── Customer Address Bar ── */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="font-semibold text-slate-900 shrink-0">{customerName}:</span>
          <span className="truncate text-slate-600">{customerAddress}</span>
        </div>
      </div>
    </div>
  );
}
