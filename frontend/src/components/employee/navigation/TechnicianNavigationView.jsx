/**
 * TechnicianNavigationView.jsx
 *
 * Authoritative Field Technician Navigation State Router for CalTrack.
 *
 * Explicit Job Status Mapping:
 *  - 'accepted'    -> TechnicianFirstPersonNavView (Pre-travel / First-Person Turn-by-Turn Navigation)
 *  - 'on_the_way'  -> TechnicianFirstPersonNavView (Active First-Person Turn-by-Turn Driving Navigation)
 *  - 'arrived'     -> TechnicianArrivalView (Contextual 2D Arrival Map + 300m Geofence + Call Customer)
 *  - 'in_progress' -> null (EmployeeDashboardPage renders ClockInCard, work timer, scope extensions & post-service proof)
 *  - 'completed'   -> null (EmployeeDashboardPage renders settlement & completion summary)
 *  - 'cancelled'   -> null (EmployeeDashboardPage renders cancellation notice / available state)
 *  - other         -> null (No fallback assumptions)
 */

import React from 'react';
import { TechnicianFirstPersonNavView } from './TechnicianFirstPersonNavView.jsx';
import { TechnicianArrivalView } from './TechnicianArrivalView.jsx';

export function TechnicianNavigationView({
  job,
  technicianLocation,
  preServiceState = {},
  geofenceRadius = 250,
  onLocationReport,
  onExitNavigation,
}) {
  const status = job?.status;

  switch (status) {
    case 'accepted':
    case 'on_the_way':
      return (
        <TechnicianFirstPersonNavView
          job={job}
          technicianLocation={technicianLocation}
          preServiceState={preServiceState}
          geofenceRadius={geofenceRadius}
          onLocationReport={onLocationReport}
          onExitNavigation={onExitNavigation}
        />
      );

    case 'arrived':
      return (
        <TechnicianArrivalView
          job={job}
          technicianLocation={technicianLocation}
          geofenceRadius={geofenceRadius}
        />
      );

    case 'in_progress':
    case 'completed':
    case 'cancelled':
    default:
      return null;
  }
}
