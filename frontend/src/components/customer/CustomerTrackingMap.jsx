/**
 * CustomerTrackingMap.jsx
 *
 * Dedicated, full-screen ready Customer Live Tracking Component for CalTrack.
 * Displays technician live position, customer destination, route path, status badge,
 * and Work Start OTP without exposing technician private data.
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Car, ShieldCheck, Clock, RefreshCw, AlertCircle } from 'lucide-react';

export function CustomerTrackingMap({
  trackingData,
  isLoading = false,
  onRefresh,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const techMarkerRef = useRef(null);
  const custMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);

  const custLat = trackingData?.customer_location?.latitude;
  const custLon = trackingData?.customer_location?.longitude;
  const techLoc = trackingData?.assigned_technician?.location;
  const techLat = techLoc?.latitude;
  const techLon = techLoc?.longitude;
  const heading = techLoc?.heading || 0;
  const status = trackingData?.status || 'ASSIGNED';
  const startOtp = trackingData?.start_otp;
  const freshness = trackingData?.freshness_state || 'LIVE';

  // Initialize Leaflet map if available in window or fallback gracefully
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Leaflet is available globally via CDN or imported
    const L = window.L;
    if (!L) {
      setMapLoaded(true);
      return;
    }

    if (!mapInstanceRef.current) {
      const initialLat = custLat || techLat || 12.9716;
      const initialLon = custLon || techLon || 77.5946;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([initialLat, initialLon], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Route Polyline
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    const bounds = [];

    // Customer Marker
    if (custLat && custLon) {
      bounds.push([custLat, custLon]);
      if (!custMarkerRef.current) {
        const custIcon = L.divIcon({
          className: 'cust-marker-custom',
          html: `<div style="background:#ef4444;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;font-weight:bold;font-size:14px;">🏠</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        custMarkerRef.current = L.marker([custLat, custLon], { icon: custIcon }).addTo(map);
      } else {
        custMarkerRef.current.setLatLng([custLat, custLon]);
      }
    }

    // Technician Marker
    if (techLat && techLon && !['COMPLETED', 'CANCELLED', 'REDISPATCHING'].includes(status)) {
      bounds.push([techLat, techLon]);
      if (!techMarkerRef.current) {
        const techIcon = L.divIcon({
          className: 'tech-marker-custom',
          html: `<div style="background:#2563eb;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(37,99,235,0.4);border:2px solid white;font-size:16px;transform:rotate(${heading}deg);transition:transform 0.5s ease;">🏍️</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        techMarkerRef.current = L.marker([techLat, techLon], { icon: techIcon }).addTo(map);
      } else {
        techMarkerRef.current.setLatLng([techLat, techLon]);
      }
    } else if (techMarkerRef.current) {
      map.removeLayer(techMarkerRef.current);
      techMarkerRef.current = null;
    }

    // Route Line
    if (custLat && custLon && techLat && techLon && !['COMPLETED', 'CANCELLED'].includes(status)) {
      const latlngs = [[techLat, techLon], [custLat, custLon]];
      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(latlngs, {
          color: '#3b82f6',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.8,
        }).addTo(map);
      } else {
        routePolylineRef.current.setLatLngs(latlngs);
      }
    } else if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [custLat, custLon, techLat, techLon, heading, status]);

  return (
    <div className={`relative w-full h-full flex flex-col bg-slate-900 overflow-hidden ${className}`}>
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0 min-h-[360px]" />

      {/* Floating Status Header Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-700/60 pointer-events-auto flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Live Status</div>
            <div className="text-xs font-bold text-white tracking-wide">{status.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="bg-slate-900/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-slate-700/60 pointer-events-auto text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95"
            title="Refresh location"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        )}
      </div>

      {/* Floating Work Start OTP Alert if Available */}
      {startOtp && status !== 'COMPLETED' && (
        <div className="absolute top-16 left-4 right-4 z-10 pointer-events-none">
          <div className="bg-gradient-to-r from-amber-500/95 to-orange-500/95 text-white p-3 rounded-xl shadow-xl backdrop-blur-sm pointer-events-auto flex items-center justify-between border border-amber-400/40">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-100">Work Start Security OTP</div>
              <div className="text-xs text-amber-50">Share this code with technician upon arrival:</div>
            </div>
            <div className="bg-white text-slate-900 text-base font-mono font-black tracking-widest px-3 py-1 rounded-lg shadow-inner">
              {startOtp}
            </div>
          </div>
        </div>
      )}

      {/* Technician & ETA Footer Overlay */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-auto">
        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-700/70 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold">
                {trackingData?.assigned_technician?.name?.[0] || 'T'}
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {trackingData?.assigned_technician?.name || 'Assigned Professional'}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified CalTrack Technician
                </div>
              </div>
            </div>

            {trackingData?.distance_m !== null && trackingData?.distance_m !== undefined && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Distance</div>
                <div className="text-xs font-bold text-blue-400">
                  {trackingData.distance_m < 1000
                    ? `${Math.round(trackingData.distance_m)} m`
                    : `${(trackingData.distance_m / 1000).toFixed(1)} km`}
                </div>
              </div>
            )}
          </div>

          {trackingData?.customer_location?.address && (
            <div className="text-[11px] text-slate-400 truncate pt-2 border-t border-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span>{trackingData.customer_location.address}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
