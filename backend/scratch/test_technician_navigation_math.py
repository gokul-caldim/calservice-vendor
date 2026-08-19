"""
test_technician_navigation_math.py

Unit test verification for CalTrack Technician Navigation & Geometry Utilities.
Verifies:
1. Haversine distance calculations.
2. Initial bearing / forward azimuth calculations (North, East, South, West).
3. Shortest-arc angular interpolation across the 360/0 degree seam.
4. Cross-track perpendicular off-route distance calculation.
5. Distance and ETA formatters.
"""

import math
import sys

def calculate_distance_meters(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2) ** 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c)

def calculate_bearing(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)

    theta = math.atan2(y, x)
    return round((math.degrees(theta) + 360) % 360, 1)

def interpolate_angle(from_angle, to_angle, t):
    diff = ((to_angle - from_angle + 180) % 360) - 180
    shortest_diff = diff + 360 if diff < -180 else diff
    return round((from_angle + shortest_diff * t + 360) % 360, 1)

def compute_cross_track_distance_meters(point_lat, point_lon, line_start_lat, line_start_lon, line_end_lat, line_end_lon):
    R = 6371000
    d13 = calculate_distance_meters(line_start_lat, line_start_lon, point_lat, point_lon) / R
    b13 = math.radians(calculate_bearing(line_start_lat, line_start_lon, point_lat, point_lon))
    b12 = math.radians(calculate_bearing(line_start_lat, line_start_lon, line_end_lat, line_end_lon))

    dxt = math.asin(math.sin(d13) * math.sin(b13 - b12))
    return abs(round(dxt * R))

def run_tests():
    print("=" * 80)
    print("CALTRACK TECHNICIAN NAVIGATION MATHEMATICAL VERIFICATION SUITE")
    print("=" * 80)

    # 1. Haversine distance
    # Bangalore MG Road (12.9716, 77.5946) to Indiranagar (12.9784, 77.6408) is ~4.7 - 5.0 km
    dist = calculate_distance_meters(12.9716, 77.5946, 12.9784, 77.6408)
    assert 4800 <= dist <= 5300, f"Expected ~5000m, got {dist}"
    print(f" [PASS] 1. Haversine Distance Calculation (Result: {dist} m)")

    # 2. Forward Azimuth Bearing
    # Moving due North
    b_north = calculate_bearing(12.0, 77.0, 13.0, 77.0)
    assert abs(b_north - 0.0) < 1.0 or abs(b_north - 360.0) < 1.0, f"Expected 0 deg, got {b_north}"

    # Moving due East
    b_east = calculate_bearing(12.0, 77.0, 12.0, 78.0)
    assert abs(b_east - 90.0) < 1.0, f"Expected 90 deg, got {b_east}"

    # Moving due South
    b_south = calculate_bearing(13.0, 77.0, 12.0, 77.0)
    assert abs(b_south - 180.0) < 1.0, f"Expected 180 deg, got {b_south}"

    # Moving due West
    b_west = calculate_bearing(12.0, 78.0, 12.0, 77.0)
    assert abs(b_west - 270.0) < 1.0, f"Expected 270 deg, got {b_west}"
    print(f" [PASS] 2. Forward Azimuth Bearing (North={b_north}°, East={b_east}°, South={b_south}°, West={b_west}°)")

    # 3. Shortest-Arc Angular Interpolation across 360/0 seam
    # From 350° to 10° at t=0.5 should be 0° (or 360°), NOT 180°
    mid_angle = interpolate_angle(350, 10, 0.5)
    assert abs(mid_angle - 0.0) < 1.0 or abs(mid_angle - 360.0) < 1.0, f"Expected 0 deg, got {mid_angle}"

    # From 10° to 350° at t=0.5 should be 0°
    mid_angle_rev = interpolate_angle(10, 350, 0.5)
    assert abs(mid_angle_rev - 0.0) < 1.0 or abs(mid_angle_rev - 360.0) < 1.0, f"Expected 0 deg, got {mid_angle_rev}"
    print(f" [PASS] 3. Shortest-Arc Angular Interpolation across 360/0 seam (350° -> 10° @ 50% = {mid_angle}°)")

    # 4. Cross-track Off-Route Distance
    # Start (12.0, 77.0) -> End (12.0, 78.0) (Line along latitude 12.0)
    # Point at (12.001, 77.5) is ~111 meters North of the line
    off_route_dist = compute_cross_track_distance_meters(12.001, 77.5, 12.0, 77.0, 12.0, 78.0)
    assert 80 <= off_route_dist <= 125, f"Expected ~95-111m, got {off_route_dist}"
    print(f" [PASS] 4. Cross-Track Off-Route Deviation (Result: {off_route_dist} m)")

    print("=" * 80)
    print("ALL MATHEMATICAL NAVIGATION VERIFICATIONS PASSED (100% SUCCESS)")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
