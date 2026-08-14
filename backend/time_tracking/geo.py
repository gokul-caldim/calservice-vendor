"""
Geofencing Decision Engine for Clock-In Validation
Evaluates GPS coordinates against saved Locations / JobSites.
Supports Circle, Polygon (GeoJSON), Hybrid, and Admin Overrides.
"""

import math
from dataclasses import dataclass
from typing import Optional, Tuple


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lng pairs on Earth."""
    R = 6371000.0
    f_lat1, f_lon1 = float(lat1), float(lon1)
    f_lat2, f_lon2 = float(lat2), float(lon2)
    phi1 = math.radians(f_lat1)
    phi2 = math.radians(f_lat2)
    delta_phi = math.radians(f_lat2 - f_lat1)
    delta_lambda = math.radians(f_lon2 - f_lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c



def point_in_polygon(point: Tuple[float, float], polygon: list) -> bool:
    """Ray-casting algorithm to determine if point (lat, lng) is inside polygon coordinates."""
    lat, lng = point
    inside = False
    n = len(polygon)
    if n < 3:
        return False

    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][1], polygon[i][0]
        xj, yj = polygon[j][1], polygon[j][0]

        intersect = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi
        )
        if intersect:
            inside = not inside
        j = i

    return inside


class TenantMismatch(Exception):
    """Raised when employee/company scope mismatch occurs."""
    pass


@dataclass
class GeofenceDecision:
    allowed: bool
    reason: str
    geofence_passed: bool
    admin_override_used: bool
    distance_m: Optional[int]
    matched_location: Optional[object]

    def to_block_response(self) -> dict:
        return {
            "error": f"Clock-in rejected: {self.reason}",
            "code": "GEOFENCE_REJECTED",
            "details": {
                "allowed": False,
                "reason": self.reason,
                "geofence_passed": self.geofence_passed,
                "distance_m": self.distance_m,
            }
        }


def evaluate(
    lat: Optional[float],
    lng: Optional[float],
    permitted_locations: list,
    is_admin: bool = False,
    request_admin_override: bool = False,
    allow_all_locations: bool = False,
) -> GeofenceDecision:
    """Evaluates clock-in location against permitted locations and geofences."""

    if allow_all_locations:
        return GeofenceDecision(
            allowed=True,
            reason="Employee has global location override enabled.",
            geofence_passed=True,
            admin_override_used=False,
            distance_m=0,
            matched_location=permitted_locations[0] if permitted_locations else None,
        )

    if lat is None or lng is None:
        if is_admin and request_admin_override:
            return GeofenceDecision(
                allowed=True,
                reason="Admin override without GPS.",
                geofence_passed=False,
                admin_override_used=True,
                distance_m=None,
                matched_location=None,
            )
        return GeofenceDecision(
            allowed=False,
            reason="GPS coordinates (lat and lon) are required for clock-in.",
            geofence_passed=False,
            admin_override_used=False,
            distance_m=None,
            matched_location=None,
        )

    if not permitted_locations:
        if is_admin and request_admin_override:
            return GeofenceDecision(
                allowed=True,
                reason="Admin override for unassigned location.",
                geofence_passed=False,
                admin_override_used=True,
                distance_m=0,
                matched_location=None,
            )
        return GeofenceDecision(
            allowed=False,
            reason="No permitted locations assigned to employee or company.",
            geofence_passed=False,
            admin_override_used=False,
            distance_m=None,
            matched_location=None,
        )

    closest_loc = None
    min_dist = float("inf")
    passed = False

    for loc in permitted_locations:
        dist = haversine_distance(lat, lng, loc.lat, loc.lng)
        if dist < min_dist:
            min_dist = dist
            closest_loc = loc

        radius = getattr(loc, "geofence_radius", 300) or 300
        gtype = getattr(loc, "geofence_type", "circle")

        circle_pass = dist <= radius
        poly_pass = False

        if gtype in ("polygon", "hybrid") and getattr(loc, "geofence_polygon", None):
            coords = loc.geofence_polygon.get("coordinates", [[]])[0]
            poly_pass = point_in_polygon((lat, lng), coords)

        if gtype == "circle" and circle_pass:
            passed = True
            break
        elif gtype == "polygon" and poly_pass:
            passed = True
            break
        elif gtype == "hybrid" and (circle_pass or poly_pass):
            passed = True
            break

    dist_int = int(min_dist) if min_dist != float("inf") else None

    if passed:
        return GeofenceDecision(
            allowed=True,
            reason="Geofence check passed successfully.",
            geofence_passed=True,
            admin_override_used=False,
            distance_m=dist_int,
            matched_location=closest_loc,
        )

    if is_admin and request_admin_override:
        return GeofenceDecision(
            allowed=True,
            reason=f"Outside geofence ({dist_int}m), allowed via Admin Override.",
            geofence_passed=False,
            admin_override_used=True,
            distance_m=dist_int,
            matched_location=closest_loc,
        )

    return GeofenceDecision(
        allowed=False,
        reason=f"Outside geofence ({dist_int}m from nearest site).",
        geofence_passed=False,
        admin_override_used=False,
        distance_m=dist_int,
        matched_location=closest_loc,
    )
