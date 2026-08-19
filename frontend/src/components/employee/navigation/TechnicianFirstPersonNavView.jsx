/**
 * TechnicianFirstPersonNavView.jsx
 *
 * Full Google-Maps-Style First-Person Turn-by-Turn Navigation View for CalTrack Technicians.
 * Reproduces the exact visual and interaction layout of the reference navigation screen:
 *  - Top Floating Deep Teal Maneuver Card (#005B52) with large directional arrow & "towards <Road Name>".
 *  - Attached "Then ↰" / "Then ←" sub-pill.
 *  - First-Person Course-Up 3D Map with Speedometer dial & North-pointing Compass.
 *  - Bottom Curved White Navigation Sheet with large green ETA, distance, arrival clock,
 *    and ✕ Exit / 🔀 Route Overview controls.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Shuffle,
  Phone,
  Compass,
  Sparkles,
  MapPin,
  Maximize2,
  Minimize2,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { TechnicianFirstPersonMap } from './TechnicianFirstPersonMap.jsx';
import { useTechnicianNavigation } from './useTechnicianNavigation.js';
import { getManeuverIcon, getManeuverSymbol } from './maneuverUtils.js';

export function TechnicianFirstPersonNavView({
  job,
  technicianLocation: initialTechLocation,
  preServiceState = {},
  geofenceRadius = 250,
  onLocationReport,
  onExitNavigation,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraMode, setCameraMode] = useState('driving'); // 'driving' or 'overview'
  const [isCourseUp, setIsCourseUp] = useState(true);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  const {
    technicianLocation,
    heading,
    custLat,
    custLon,
    directionsResult,
    activeStep,
    upcomingPreview,
    distanceToNextManeuverText,
    displayDistanceText,
    displayEtaText,
    arrivalClockText,
    isFollowMode,
    setIsFollowMode,
    isRecalculating,
    directionsFailed,
    telemetryStatus,
  } = useTechnicianNavigation({
    job,
    initialTechnicianLocation: initialTechLocation,
    onLocationReport,
  });

  const customerPhone = job?.phone || job?.customer_phone;
  const customerAddress = job?.address || job?.customer_address || 'Customer Authorized Address';

  // Toggle Route Overview
  const handleToggleRouteOverview = () => {
    if (cameraMode === 'driving') {
      setCameraMode('overview');
      setIsFollowMode(false);
    } else {
      setCameraMode('driving');
      setIsFollowMode(true);
    }
  };

  // Toggle Course-Up vs North-Up
  const handleToggleCourseUp = () => {
    setIsCourseUp((prev) => !prev);
  };

  const handleClose = () => {
    if (isFullscreen) {
      setIsFullscreen(false);
    } else if (onExitNavigation) {
      onExitNavigation();
    }
  };

  // Extracted road target
  const roadPrefix = activeStep?.roadTarget?.prefix || 'towards';
  const roadName = activeStep?.roadTarget?.roadName || activeStep?.instruction || 'Customer Location';

  return (
    <div
      id="caltrack-first-person-nav-screen"
      className={`w-full bg-slate-950 text-slate-900 transition-all font-sans select-none ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen flex flex-col'
          : 'relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[520px] sm:h-[600px]'
      }`}
    >
      {/* ── 1. Top Floating Deep Teal Maneuver Card ── */}
      <div className="absolute top-4 left-4 right-4 z-30 flex flex-col items-start pointer-events-auto">
        {/* Main Teal Banner Card */}
        <div className="w-full bg-[#005B52] text-white rounded-3xl p-4 shadow-2xl flex items-center justify-between gap-3 border border-[#00473F]/40 backdrop-blur-xs">
          <div className="flex items-center gap-4 min-w-0">
            {/* Extra-Large Directional Arrow */}
            <div className="text-white shrink-0">
              {getManeuverIcon(activeStep?.maneuverKey || 'STRAIGHT', 'w-11 h-11 stroke-[2.5]')}
            </div>

            {/* Road Headline */}
            <div className="min-w-0 flex flex-col justify-center">
              {isRecalculating ? (
                <span className="text-amber-200 animate-pulse text-lg font-bold">Recalculating route...</span>
              ) : (
                <div className="text-xl sm:text-2xl font-black text-white leading-tight truncate">
                  {roadPrefix ? <span className="font-normal text-teal-100/90 text-lg mr-1.5">{roadPrefix}</span> : null}
                  <span>{roadName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Badge (Sparkles / Maximize) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Driving Navigation'}
              className="w-12 h-12 rounded-full bg-white text-blue-600 shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-slate-800" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                    fill="#2563EB"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Attached Sub-Pill: "Then ↰" */}
        {upcomingPreview && !isRecalculating && (
          <div className="mt-1 ml-4 px-4 py-1.5 bg-[#00473F] text-white text-xs font-black rounded-b-2xl shadow-lg border-x border-b border-[#003831] flex items-center gap-1.5 animate-fadeIn">
            <span className="opacity-90">Then</span>
            <span className="text-base leading-none">{upcomingPreview.symbol}</span>
          </div>
        )}
      </div>

      {/* ── 2. Interactive Map Canvas ── */}
      <div className="flex-1 w-full h-full min-h-[420px] bg-slate-900 relative">
        <TechnicianFirstPersonMap
          job={job}
          technicianLocation={technicianLocation}
          heading={heading}
          custLat={custLat}
          custLon={custLon}
          directionsResult={directionsResult}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          isFollowMode={isFollowMode}
          onFollowModeChange={setIsFollowMode}
          isCourseUp={isCourseUp}
          onToggleCourseUp={handleToggleCourseUp}
          isFullscreen={isFullscreen}
          geofenceRadius={geofenceRadius}
          className="w-full h-full"
        />
      </div>

      {/* ── 3. Bottom White Curved Navigation Sheet ── */}
      <div className="relative z-30 bg-white text-slate-900 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.18)] border-t border-slate-100 flex flex-col transition-all">
        {/* Drag / Expand Handle */}
        <button
          type="button"
          onClick={() => setIsSheetExpanded((prev) => !prev)}
          className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 rounded-t-3xl"
        >
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </button>

        {/* Primary Metrics Row */}
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Left Action: Close / Exit Navigation Button */}
          <button
            type="button"
            onClick={handleClose}
            title="Exit / Minimize Navigation"
            className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Center Trip Metrics: Large Green ETA + Distance/Clock */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 leading-none tracking-tight">
              {displayEtaText}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              {displayDistanceText && arrivalClockText
                ? `${displayDistanceText} • ${arrivalClockText}`
                : displayDistanceText
                ? `${displayDistanceText} • Calculating...`
                : 'Calculating route...'}
            </div>
          </div>

          {/* Right Action: Route Overview Toggle Button */}
          <button
            type="button"
            onClick={handleToggleRouteOverview}
            title={cameraMode === 'driving' ? 'Show Route Overview' : 'Resume 3D Driving View'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-xs ${
              cameraMode === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Shuffle className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Expandable Customer Details Drawer */}
        {isSheetExpanded && (
          <div className="px-6 pb-4 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{job?.customer_name || 'Customer Destination'}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                {customerAddress}
              </div>
            </div>

            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
              >
                <Phone className="w-4 h-4" />
                <span>Call Customer</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
