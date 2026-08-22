import '../../../core/utils/json_parsing.dart';

/// Represents an individual gate check evaluation from the 9-Gate candidate eligibility engine.
class GateAuditItem {
  const GateAuditItem({
    required this.gate,
    required this.name,
    required this.passed,
  });

  factory GateAuditItem.fromJson(Map<String, dynamic> json) {
    return GateAuditItem(
      gate: parseString(json['gate']) ?? '',
      name: parseString(json['name']) ?? '',
      passed: parseBool(json['passed']),
    );
  }

  final String gate;
  final String name;
  final bool passed;
}

/// Represents an eligible technician candidate evaluated by
/// `GET /workforce/dispatch/eligible-technicians/`.
class EligibleTechnician {
  const EligibleTechnician({
    required this.id,
    this.employeeId,
    required this.name,
    this.phone,
    this.latitude,
    this.longitude,
    required this.isOnline,
    required this.currentAvailability,
    required this.registrationStatus,
    this.approvedServices = const [],
    required this.isDispatchReady,
    this.ineligibilityReason = '',
    this.distanceKm,
    this.distanceBand,
    this.score = 0.0,
    this.gpsAgeSeconds,
    this.gpsFreshness,
    this.gateAudit = const [],
  });

  factory EligibleTechnician.fromJson(Map<String, dynamic> json) {
    final servicesJson = json['approved_services'];
    final auditJson = json['gate_audit'];

    return EligibleTechnician(
      id: parseInt(json['id']) ?? 0,
      employeeId: parseString(json['employee_id']),
      name: parseString(json['name']) ?? 'Technician',
      phone: parseString(json['phone']),
      latitude: parseDouble(json['latitude']),
      longitude: parseDouble(json['longitude']),
      isOnline: parseBool(json['is_online']),
      currentAvailability:
          parseString(json['current_availability'])?.toLowerCase() ?? 'offline',
      registrationStatus:
          parseString(json['registration_status'])?.toLowerCase() ?? 'not_started',
      approvedServices: servicesJson is List
          ? servicesJson.map((e) => e.toString()).toList()
          : const [],
      isDispatchReady: parseBool(json['is_dispatch_ready']),
      ineligibilityReason: parseString(json['ineligibility_reason']) ?? '',
      distanceKm: parseDouble(json['distance_km']),
      distanceBand: parseString(json['distance_band']),
      score: parseDouble(json['score']) ?? 0.0,
      gpsAgeSeconds: parseInt(json['gps_age_seconds']),
      gpsFreshness: parseString(json['gps_freshness']),
      gateAudit: auditJson is List
          ? auditJson
              .whereType<Map<String, dynamic>>()
              .map(GateAuditItem.fromJson)
              .toList()
          : const [],
    );
  }

  final int id;
  final String? employeeId;
  final String name;
  final String? phone;
  final double? latitude;
  final double? longitude;
  final bool isOnline;
  final String currentAvailability;
  final String registrationStatus;
  final List<String> approvedServices;
  final bool isDispatchReady;
  final String ineligibilityReason;
  final double? distanceKm;
  final String? distanceBand;
  final double score;
  final int? gpsAgeSeconds;
  final String? gpsFreshness;
  final List<GateAuditItem> gateAudit;

  bool get isAvailable => isOnline && currentAvailability == 'available';
}
