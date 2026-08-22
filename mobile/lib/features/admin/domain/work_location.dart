import '../../../core/utils/json_parsing.dart';

/// Represents a company authorized work/shift location and geofence boundary.
class WorkLocation {
  const WorkLocation({
    required this.id,
    required this.name,
    this.address = '',
    this.lat,
    this.lng,
    this.geofenceRadius = 500,
    this.geofenceType = 'circle',
    this.isActive = true,
    this.createdAt,
  });

  factory WorkLocation.fromJson(Map<String, dynamic> json) {
    return WorkLocation(
      id: parseInt(json['id']) ?? 0,
      name: parseString(json['name']) ?? 'Authorized Location',
      address: parseString(json['address']) ?? '',
      lat: parseDouble(json['lat']) ?? parseDouble(json['latitude']),
      lng: parseDouble(json['lng']) ?? parseDouble(json['longitude']),
      geofenceRadius: parseInt(json['geofence_radius']) ?? 500,
      geofenceType: parseString(json['geofence_type']) ?? 'circle',
      isActive: parseBool(json['is_active'], fallback: true),
      createdAt: parseDateTime(json['created_at']),
    );
  }

  final int id;
  final String name;
  final String address;
  final double? lat;
  final double? lng;
  final int geofenceRadius;
  final String geofenceType;
  final bool isActive;
  final DateTime? createdAt;

  Map<String, dynamic> toJson() => {
        'name': name,
        'address': address,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
        'geofence_radius': geofenceRadius,
        'geofence_type': geofenceType,
        'is_active': isActive,
      };
}
