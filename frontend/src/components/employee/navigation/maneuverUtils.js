/**
 * maneuverUtils.js
 *
 * Turn-by-Turn Navigation Maneuver Parser & Step Progression Engine for CalTrack.
 * Matches Google Maps navigation UI with extracted road targets and rich directional icons.
 */

import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  GitMerge,
  Compass,
  MapPin,
  CornerUpLeft,
  CornerUpRight,
} from 'lucide-react';
import { calculateDistanceMeters, formatDistance } from './navigationUtils.js';

/**
 * Strips HTML formatting from Google Directions html_instructions.
 */
export function cleanHtmlInstructions(html = '') {
  if (!html) return '';
  return html
    .replace(/<div style="[^"]*">/gi, ' — ')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Standardizes raw Google maneuver strings into standardized keys.
 */
export function normalizeManeuverKey(maneuver = '', instructionText = '') {
  const m = (maneuver || '').toLowerCase();
  const t = (instructionText || '').toLowerCase();

  if (m.includes('turn-left') || t.startsWith('turn left')) return 'TURN_LEFT';
  if (m.includes('turn-right') || t.startsWith('turn right')) return 'TURN_RIGHT';
  if (m.includes('turn-slight-left') || t.startsWith('slight left')) return 'SLIGHT_LEFT';
  if (m.includes('turn-slight-right') || t.startsWith('slight right')) return 'SLIGHT_RIGHT';
  if (m.includes('turn-sharp-left') || t.startsWith('sharp left')) return 'SHARP_LEFT';
  if (m.includes('turn-sharp-right') || t.startsWith('sharp right')) return 'SHARP_RIGHT';
  if (m.includes('uturn') || t.includes('u-turn') || t.includes('make a u-turn')) return 'U_TURN';
  if (m.includes('keep-left') || t.startsWith('keep left')) return 'KEEP_LEFT';
  if (m.includes('keep-right') || t.startsWith('keep right')) return 'KEEP_RIGHT';
  if (m.includes('merge') || t.startsWith('merge')) return 'MERGE';
  if (m.includes('roundabout') || t.includes('roundabout')) return 'ROUNDABOUT';
  if (m.includes('straight') || t.startsWith('continue') || t.startsWith('head')) return 'STRAIGHT';
  if (t.includes('destination') || t.includes('arrive')) return 'DESTINATION';

  return 'STRAIGHT';
}

/**
 * Extracts target road name and prefix (e.g. "towards 1st Main Rd").
 */
export function extractRoadTarget(rawInstruction = '') {
  if (!rawInstruction) {
    return { prefix: 'towards', roadName: 'Destination', fullText: 'towards Destination' };
  }

  // 1. Check for toward / towards first (e.g. "Head northwest on Samathuvapuram toward 1st Main Rd")
  const towardMatch = rawInstruction.match(/(?:toward|towards)\s+([^—,.]+)/i);
  if (towardMatch && towardMatch[1]) {
    const roadName = towardMatch[1].trim();
    return {
      prefix: 'towards',
      roadName,
      fullText: `towards ${roadName}`,
    };
  }

  // 2. Check for onto (e.g. "Turn left onto Bagalur Rd")
  const ontoMatch = rawInstruction.match(/onto\s+([^—,.]+)/i);
  if (ontoMatch && ontoMatch[1]) {
    const roadName = ontoMatch[1].trim();
    return {
      prefix: 'onto',
      roadName,
      fullText: `onto ${roadName}`,
    };
  }

  // 3. Check for on / to (e.g. "Continue on Hosur Rd")
  const onMatch = rawInstruction.match(/(?:on|to)\s+([^—,.]+)/i);
  if (onMatch && onMatch[1]) {
    const roadName = onMatch[1].trim();
    return {
      prefix: 'on',
      roadName,
      fullText: `on ${roadName}`,
    };
  }

  // Fallback: clean instruction
  return {
    prefix: '',
    roadName: rawInstruction,
    fullText: rawInstruction,
  };
}

/**
 * Returns the appropriate Lucide icon component or custom SVG for a maneuver key.
 */
export function getManeuverIcon(maneuverKey, className = 'w-10 h-10') {
  switch (maneuverKey) {
    case 'TURN_LEFT':
      return React.createElement(
        'svg',
        { viewBox: '0 0 36 36', className, fill: 'none', stroke: 'currentColor', strokeWidth: '3.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M9 14 L16 7 M9 14 L16 21 M9 14 L22 14 C26 14 28 17 28 22 L28 30' })
      );
    case 'TURN_RIGHT':
      return React.createElement(
        'svg',
        { viewBox: '0 0 36 36', className, fill: 'none', stroke: 'currentColor', strokeWidth: '3.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M27 14 L20 7 M27 14 L20 21 M27 14 L14 14 C10 14 8 17 8 22 L8 30' })
      );
    case 'SLIGHT_LEFT':
      return React.createElement(
        'svg',
        { viewBox: '0 0 36 36', className, fill: 'none', stroke: 'currentColor', strokeWidth: '3.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M11 9 L19 9 M11 9 L11 17 M11 9 L24 24 L24 30' })
      );
    case 'SLIGHT_RIGHT':
      return React.createElement(
        'svg',
        { viewBox: '0 0 36 36', className, fill: 'none', stroke: 'currentColor', strokeWidth: '3.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M25 9 L17 9 M25 9 L25 17 M25 9 L12 24 L12 30' })
      );
    case 'SHARP_LEFT':
      return React.createElement(CornerUpLeft, { className });
    case 'SHARP_RIGHT':
      return React.createElement(CornerUpRight, { className });
    case 'U_TURN':
      return React.createElement(
        'svg',
        { viewBox: '0 0 36 36', className, fill: 'none', stroke: 'currentColor', strokeWidth: '3.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M10 24 L5 18 M10 24 L15 18 M10 24 L10 14 C10 7 26 7 26 14 L26 30' })
      );
    case 'KEEP_LEFT':
      return React.createElement(ArrowUpLeft, { className });
    case 'KEEP_RIGHT':
      return React.createElement(ArrowUpRight, { className });
    case 'MERGE':
      return React.createElement(GitMerge, { className });
    case 'ROUNDABOUT':
      return React.createElement(RotateCcw, { className });
    case 'DESTINATION':
      return React.createElement(MapPin, { className });
    case 'STRAIGHT':
    default:
      // Google-Maps-style straight arrow with bold head and dashed stem
      return React.createElement(
        'svg',
        { viewBox: '0 0 36 36', className, fill: 'none', stroke: 'currentColor', strokeWidth: '3.5', strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M18 5 L10 14 M18 5 L26 14 M18 5 L18 16' }),
        React.createElement('line', { x1: '18', y1: '21', x2: '18', y2: '23', strokeWidth: '4', strokeDasharray: '1 2' }),
        React.createElement('line', { x1: '18', y1: '27', x2: '18', y2: '29', strokeWidth: '4', strokeDasharray: '1 2' })
      );
  }
}

/**
 * Returns symbol character for sub-pill (e.g. "Then ↰").
 */
export function getManeuverSymbol(maneuverKey) {
  switch (maneuverKey) {
    case 'TURN_LEFT':
      return '←';
    case 'TURN_RIGHT':
      return '→';
    case 'SLIGHT_LEFT':
      return '↰';
    case 'SLIGHT_RIGHT':
      return '↱';
    case 'SHARP_LEFT':
      return '⤹';
    case 'SHARP_RIGHT':
      return '⤸';
    case 'U_TURN':
      return '↩';
    case 'ROUNDABOUT':
      return '⟳';
    case 'DESTINATION':
      return '📍';
    case 'STRAIGHT':
    default:
      return '↑';
  }
}

/**
 * Extracts and standardizes step information from a Google Directions step object.
 */
export function parseRouteStep(step, index = 0, isLastStep = false) {
  if (!step) return null;

  const rawInstruction = cleanHtmlInstructions(step.instructions || step.html_instructions || '');
  const maneuverKey = isLastStep ? 'DESTINATION' : normalizeManeuverKey(step.maneuver, rawInstruction);
  const roadTarget = extractRoadTarget(rawInstruction);

  const startLat = typeof step.start_location?.lat === 'function' ? step.start_location.lat() : step.start_location?.lat;
  const startLng = typeof step.start_location?.lng === 'function' ? step.start_location.lng() : step.start_location?.lng;
  const endLat = typeof step.end_location?.lat === 'function' ? step.end_location.lat() : step.end_location?.lat;
  const endLng = typeof step.end_location?.lng === 'function' ? step.end_location.lng() : step.end_location?.lng;

  const stepDistanceMeters = step.distance?.value != null
    ? step.distance.value
    : (startLat != null && endLat != null ? calculateDistanceMeters(startLat, startLng, endLat, endLng) : 0);

  return {
    index,
    maneuverKey,
    instruction: rawInstruction || (isLastStep ? 'Arrive at Customer Location' : 'Continue on road'),
    roadTarget,
    stepDistanceMeters,
    stepDistanceText: step.distance?.text || formatDistance(stepDistanceMeters),
    stepDurationText: step.duration?.text || '',
    startLocation: { lat: startLat, lng: startLng },
    endLocation: { lat: endLat, lng: endLng },
    path: step.path || step.lat_lngs || [],
  };
}

/**
 * Analyzes technician coordinates against all route steps and identifies the active step.
 */
export function findActiveStepIndex(steps = [], techLat, techLon, currentActiveIndex = 0) {
  if (!steps || steps.length === 0) return 0;
  if (techLat == null || techLon == null) return currentActiveIndex;

  let bestIndex = currentActiveIndex;
  let minDistance = Infinity;

  const startIndex = Math.max(0, currentActiveIndex - 1);
  const endIndex = Math.min(steps.length - 1, currentActiveIndex + 3);

  for (let i = startIndex; i <= endIndex; i++) {
    const step = steps[i];
    if (!step?.endLocation?.lat || !step?.endLocation?.lng) continue;

    const distToEnd = calculateDistanceMeters(techLat, techLon, step.endLocation.lat, step.endLocation.lng);

    // If technician is within 25 meters of step completion, advance to next step
    if (i === currentActiveIndex && distToEnd <= 25 && i < steps.length - 1) {
      return i + 1;
    }

    if (distToEnd < minDistance) {
      minDistance = distToEnd;
      bestIndex = i;
    }
  }

  return Math.max(currentActiveIndex, bestIndex);
}

/**
 * Computes the remaining distance to the next maneuver step.
 */
export function computeDistanceToNextManeuver(activeStep, techLat, techLon) {
  if (!activeStep?.endLocation?.lat || !activeStep?.endLocation?.lng) {
    return activeStep?.stepDistanceMeters || 0;
  }
  if (techLat == null || techLon == null) {
    return activeStep.stepDistanceMeters || 0;
  }

  const dist = calculateDistanceMeters(techLat, techLon, activeStep.endLocation.lat, activeStep.endLocation.lng);
  return dist != null ? Math.max(0, dist) : activeStep.stepDistanceMeters;
}

/**
 * Formats the short upcoming preview for the step immediately following the active step.
 */
export function getUpcomingManeuverPreview(steps = [], activeIndex = 0) {
  const nextStep = steps[activeIndex + 1];
  if (!nextStep) return null;

  const symbol = getManeuverSymbol(nextStep.maneuverKey);
  return {
    iconKey: nextStep.maneuverKey,
    symbol,
    text: `Then ${symbol}`,
    fullPreview: `Then ${nextStep.instruction}`,
  };
}
