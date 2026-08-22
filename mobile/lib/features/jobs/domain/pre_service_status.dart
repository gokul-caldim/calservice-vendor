import '../../../core/utils/json_parsing.dart';

/// Mirrors GET /workforce/jobs/{id}/pre-service-status/
/// (backend WorkforceJobPreServiceStatusView) — the arrival checklist state.
/// Geofence must pass before OTP/photos unlock in the UI, matching the web
/// app's ordering exactly, even though it's a client-side (not API-level)
/// gate.
class PreServiceStatus {
  const PreServiceStatus({
    required this.geofencePassed,
    required this.otpVerified,
    required this.presencePhoto,
    required this.appliancePhoto,
    required this.workAreaPhoto,
    required this.isComplete,
  });

  factory PreServiceStatus.fromJson(Map<String, dynamic> json) {
    return PreServiceStatus(
      geofencePassed: parseBool(json['geofence_passed']),
      otpVerified: parseBool(json['otp_verified']),
      presencePhoto: parseBool(json['presence_photo']),
      appliancePhoto: parseBool(json['appliance_photo']),
      workAreaPhoto: parseBool(json['work_area_photo']),
      isComplete: parseBool(json['is_complete']),
    );
  }

  static const initial = PreServiceStatus(
    geofencePassed: false,
    otpVerified: false,
    presencePhoto: false,
    appliancePhoto: false,
    workAreaPhoto: false,
    isComplete: false,
  );

  final bool geofencePassed;
  final bool otpVerified;
  final bool presencePhoto;
  final bool appliancePhoto;
  final bool workAreaPhoto;
  final bool isComplete;

  PreServiceStatus copyWith({
    bool? geofencePassed,
    bool? otpVerified,
    bool? presencePhoto,
    bool? appliancePhoto,
    bool? workAreaPhoto,
    bool? isComplete,
  }) {
    return PreServiceStatus(
      geofencePassed: geofencePassed ?? this.geofencePassed,
      otpVerified: otpVerified ?? this.otpVerified,
      presencePhoto: presencePhoto ?? this.presencePhoto,
      appliancePhoto: appliancePhoto ?? this.appliancePhoto,
      workAreaPhoto: workAreaPhoto ?? this.workAreaPhoto,
      isComplete: isComplete ?? this.isComplete,
    );
  }
}

/// The three required pre-service photo slots, in the exact order the web
/// app captures them.
enum PreServicePhotoType {
  presence('presence', 'Presence Selfie'),
  appliance('appliance', 'Before Appliance Photo'),
  workArea('work_area', 'Before Work-Area Photo');

  const PreServicePhotoType(this.apiValue, this.label);
  final String apiValue;
  final String label;
}
