import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/jobs/domain/pre_service_status.dart';

void main() {
  group('PreServiceStatus', () {
    test('parses from JSON correctly', () {
      final json = {
        'geofence_passed': true,
        'otp_verified': true,
        'presence_photo': true,
        'appliance_photo': false,
        'work_area_photo': false,
        'is_complete': false,
      };

      final status = PreServiceStatus.fromJson(json);

      expect(status.geofencePassed, isTrue);
      expect(status.otpVerified, isTrue);
      expect(status.presencePhoto, isTrue);
      expect(status.appliancePhoto, isFalse);
      expect(status.workAreaPhoto, isFalse);
      expect(status.isComplete, isFalse);
    });

    test('initial status has all flags as false', () {
      const status = PreServiceStatus.initial;

      expect(status.geofencePassed, isFalse);
      expect(status.otpVerified, isFalse);
      expect(status.presencePhoto, isFalse);
      expect(status.appliancePhoto, isFalse);
      expect(status.workAreaPhoto, isFalse);
      expect(status.isComplete, isFalse);
    });

    test('copyWith updates specific fields properly', () {
      const status = PreServiceStatus.initial;
      final updated = status.copyWith(geofencePassed: true, isComplete: true);

      expect(updated.geofencePassed, isTrue);
      expect(updated.otpVerified, isFalse);
      expect(updated.isComplete, isTrue);
    });

    test('PreServicePhotoType has correct api values and labels', () {
      expect(PreServicePhotoType.presence.apiValue, equals('presence'));
      expect(PreServicePhotoType.presence.label, equals('Presence Selfie'));

      expect(PreServicePhotoType.appliance.apiValue, equals('appliance'));
      expect(PreServicePhotoType.appliance.label, equals('Before Appliance Photo'));

      expect(PreServicePhotoType.workArea.apiValue, equals('work_area'));
      expect(PreServicePhotoType.workArea.label, equals('Before Work-Area Photo'));
    });
  });
}
