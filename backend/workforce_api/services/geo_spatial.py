"""
workforce_api/services/geo_spatial.py

Authoritative Geographic and Spatial Utility Engine for CalTrack Workforce.
Provides:
  - High-precision Haversine geodesic distance calculation
  - Mathematical bounding-box prefiltering
  - Destination point calculation for 360-degree multi-bearing navigation/testing
  - Distance band classification (0-1km, 1-2km, 2-5km, 5-10km, 10-15km, 15-20km)
  - Coordinate validation and boundary enforcement
"""
import math
import logging
from typing import Optional, Tuple, Dict, Any, List

logger = logging.getLogger("workforce.geo_spatial")

# Earth Radii
EARTH_RADIUS_KM: float = 6371.0
EARTH_RADIUS_METERS: float = 6371000.0
LATITUDE_KM_APPROX: float = 111.32

# Production Constants
ADMIN_DISPATCH_RADIUS_KM: float = 20.0
MAX_DISPATCH_RADIUS_KM: float = 20.0
MAX_GPS_AGE_SECONDS: int = 120
DISTANCE_TOLERANCE_KM: float = 0.005  # 5 meters numerical precision buffer for boundary testing

# Standard Distance Waves / Bands (0 to 20 km)
WAVE_RANGES: List[Tuple[int, str, float, float]] = [
    (1, "Wave 1 (0–1 km)", 0.0, 1.0),
    (2, "Wave 2 (>1–2 km)", 1.0, 2.0),
    (3, "Wave 3 (>2–5 km)", 2.0, 5.0),
    (4, "Wave 4 (>5–10 km)", 5.0, 10.0),
    (5, "Wave 5 (>10–15 km)", 10.0, 15.0),
    (6, "Wave 6 (>15–20 km)", 15.0, 20.0),
]

DISTANCE_BANDS: List[Tuple[str, float, float]] = [
    ("0-1km", 0.0, 1.0),
    ("1-2km", 1.0, 2.0),
    ("2-5km", 2.0, 5.0),
    ("5-10km", 5.0, 10.0),
    ("10-15km", 10.0, 15.0),
    ("15-20km", 15.0, 20.0),
]


def validate_coordinates(lat: Any, lon: Any) -> Tuple[bool, Optional[float], Optional[float], str]:
    """
    Validates that latitude and longitude are non-null, valid numeric,
    within the valid geographic ranges [-90.0, 90.0] and [-180.0, 180.0],
    and not NaN/Infinite.

    Returns: (is_valid, lat_float, lon_float, error_message)
    """
    if lat is None or lon is None:
        return False, None, None, "Coordinates cannot be null."

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        return False, None, None, f"Coordinates must be numeric (got lat={lat}, lon={lon})."

    if math.isnan(lat_f) or math.isinf(lat_f) or math.isnan(lon_f) or math.isinf(lon_f):
        return False, None, None, "Coordinates cannot be NaN or Infinite."

    if not (-90.0 <= lat_f <= 90.0):
        return False, None, None, f"Latitude {lat_f} out of valid range [-90.0, 90.0]."

    if not (-180.0 <= lon_f <= 180.0):
        return False, None, None, f"Longitude {lon_f} out of valid range [-180.0, 180.0]."

    return True, lat_f, lon_f, ""


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes exact Haversine geodesic distance in kilometers between two points
    on Earth's surface with high numerical stability.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2) + (
        math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    # Clamp a to [0.0, 1.0] to prevent math domain error with sqrt due to floating point inaccuracies
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c


def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes exact Haversine distance in meters.
    """
    return calculate_distance_km(lat1, lon1, lat2, lon2) * 1000.0


def get_spatial_bounding_box(
    lat: float, lon: float, radius_km: float = ADMIN_DISPATCH_RADIUS_KM
) -> Tuple[float, float, float, float]:
    """
    Computes a mathematically correct geographic bounding box prefilter
    surrounding (lat, lon) with given radius_km (including 5% safety buffer
    to prevent spherical distortion clipping).

    Returns: (min_lat, max_lat, min_lon, max_lon)
    """
    buffered_radius = radius_km * 1.05
    delta_lat = buffered_radius / LATITUDE_KM_APPROX
    min_lat = max(-90.0, lat - delta_lat)
    max_lat = min(90.0, lat + delta_lat)

    # Longitude delta depends on latitude: Δlon = Δlat / cos(lat)
    # Handle poles / extreme latitudes safely
    cos_lat = math.cos(math.radians(lat))
    if abs(lat) >= 89.9 or cos_lat < 0.001:
        min_lon = -180.0
        max_lon = 180.0
    else:
        delta_lon = delta_lat / cos_lat
        min_lon = lon - delta_lon
        max_lon = lon + delta_lon
        # Handle dateline wrapping
        if min_lon < -180.0:
            min_lon = -180.0
        if max_lon > 180.0:
            max_lon = 180.0

    return min_lat, max_lat, min_lon, max_lon


def classify_wave(distance_km: float) -> Optional[int]:
    """
    Authoritative sequential distance wave classifier (Phase 1):
      Wave 1: 0.0 to 1.0 km (0 <= d <= 1.0)
      Wave 2: >1.0 to 2.0 km (1.0 < d <= 2.0)
      Wave 3: >2.0 to 5.0 km (2.0 < d <= 5.0)
      Wave 4: >5.0 to 10.0 km (5.0 < d <= 10.0)
      Wave 5: >10.0 to 15.0 km (10.0 < d <= 15.0)
      Wave 6: >15.0 to 20.0 km (15.0 < d <= 20.0)
      > 20.0 km: None (strictly outside automatic dispatch)

    Uses exact mathematical floating-point comparison without pre-rounding.
    """
    if distance_km is None or distance_km < 0.0 or distance_km > 20.0:
        return None
    if distance_km <= 1.0:
        return 1
    elif distance_km <= 2.0:
        return 2
    elif distance_km <= 5.0:
        return 3
    elif distance_km <= 10.0:
        return 4
    elif distance_km <= 15.0:
        return 5
    elif distance_km <= 20.0:
        return 6
    return None


def get_distance_band(distance_km: float) -> str:
    """
    Categorizes distance into standard operational display bands:
    '0-1km', '1-2km', '2-5km', '5-10km', '10-15km', '15-20km', or '>20km'.
    """
    if distance_km is None or distance_km < 0.0:
        return "unknown"
    wave = classify_wave(distance_km)
    if wave == 1:
        return "0-1km"
    elif wave == 2:
        return "1-2km"
    elif wave == 3:
        return "2-5km"
    elif wave == 4:
        return "5-10km"
    elif wave == 5:
        return "10-15km"
    elif wave == 6:
        return "15-20km"
    return ">20km"


def is_within_automatic_radius(distance_km: float) -> bool:
    """
    Strictly checks if distance is within the 20.0 km automatic dispatch boundary.
    No numerical tolerance expansion is applied to extend the business radius.
    """
    if distance_km is None:
        return False
    return 0.0 <= distance_km <= 20.0


def is_within_radius(
    distance_km: float,
    radius_km: float = ADMIN_DISPATCH_RADIUS_KM,
    tolerance_km: float = 0.0,
) -> bool:
    """
    Authoritatively checks if distance_km is within radius_km.
    Strictly adheres to boundary: <= 20.000 km eligible, > 20.000 km ineligible.
    """
    if distance_km is None:
        return False
    return distance_km <= (radius_km + tolerance_km)


def destination_point(
    lat: float, lon: float, distance_km: float, bearing_degrees: float
) -> Tuple[float, float]:
    """
    Calculates the destination coordinate (lat2, lon2) starting from (lat, lon),
    traveling distance_km along a true bearing_degrees (0° = North, 90° = East, 180° = South, 270° = West).
    
    Formula based on spherical geodesy:
      lat2 = asin( sin(lat1)*cos(d/R) + cos(lat1)*sin(d/R)*cos(θ) )
      lon2 = lon1 + atan2( sin(θ)*sin(d/R)*cos(lat1), cos(d/R) - sin(lat1)*sin(lat2) )
    """
    r = EARTH_RADIUS_KM
    d_div_r = distance_km / r
    theta = math.radians(bearing_degrees)
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)

    sin_phi1 = math.sin(phi1)
    cos_phi1 = math.cos(phi1)
    sin_d = math.sin(d_div_r)
    cos_d = math.cos(d_div_r)

    phi2 = math.asin(sin_phi1 * cos_d + cos_phi1 * sin_d * math.cos(theta))
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * sin_d * cos_phi1,
        cos_d - sin_phi1 * math.sin(phi2),
    )

    # Normalize longitude to [-180, 180]
    lon2_deg = (math.degrees(lambda2) + 540.0) % 360.0 - 180.0
    lat2_deg = math.degrees(phi2)

    return lat2_deg, lon2_deg
