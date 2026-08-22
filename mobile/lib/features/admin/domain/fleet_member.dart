import '../../../core/utils/json_parsing.dart';

/// Represents a technician's live presence & telemetry returned by
/// `GET /workforce/presence/fleet-map/`.
class FleetMember {
  const FleetMember({
    required this.id,
    this.employeeId,
    required this.name,
    this.phone,
    required this.isOnline,
    required this.currentAvailability,
    required this.registrationStatus,
    required this.hasLocation,
    this.latitude,
    this.longitude,
    this.accuracy,
    this.lastUpdate,
    this.locationStatus,
    this.activeJob,
  });

  factory FleetMember.fromJson(Map<String, dynamic> json) {
    return FleetMember(
      id: parseInt(json['id']) ?? 0,
      employeeId: parseString(json['employee_id']),
      name: parseString(json['name']) ?? 'Technician',
      phone: parseString(json['phone']),
      isOnline: parseBool(json['is_online']),
      currentAvailability:
          parseString(json['current_availability'])?.toLowerCase() ?? 'offline',
      registrationStatus:
          parseString(json['registration_status'])?.toLowerCase() ?? 'not_started',
      hasLocation: parseBool(json['has_location']),
      latitude: parseDouble(json['latitude']),
      longitude: parseDouble(json['longitude']),
      accuracy: parseDouble(json['accuracy']),
      lastUpdate: parseDateTime(json['last_update']),
      locationStatus: parseString(json['location_status']),
      activeJob: parseString(json['active_job']),
    );
  }

  final int id;
  final String? employeeId;
  final String name;
  final String? phone;
  final bool isOnline;
  final String currentAvailability;
  final String registrationStatus;
  final bool hasLocation;
  final double? latitude;
  final double? longitude;
  final double? accuracy;
  final DateTime? lastUpdate;
  final String? locationStatus;
  final String? activeJob;

  bool get isOnActiveJob => isOnline && (activeJob != null && activeJob!.isNotEmpty);
  bool get isAvailable => isOnline && (activeJob == null || activeJob!.isEmpty);
}
