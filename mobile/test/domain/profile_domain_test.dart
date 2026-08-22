import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/domain/employee_profile.dart';

void main() {
  group('Profile & Document Domain Models', () {
    test('parses full EmployeeProfile JSON correctly', () {
      final json = {
        'id': 24,
        'user_id': 105,
        'employee_id': 'ORG--0024',
        'first_name': 'Mani',
        'last_name': 'S',
        'email': 'mani@gmail.com',
        'mobile_number': '1234597890',
        'phone': '1234597890',
        'bio': 'Certified Air Conditioning & Refrigeration Specialist',
        'timezone': 'Asia/Kolkata',
        'language': 'en',
        'avatar': 'https://example.com/avatar.jpg',
        'title': 'Senior AC Technician',
        'company_name': 'CalServices Vendor Corp',
        'department': 'Field Operations',
        'state': 'California',
        'country': 'United States',
        'hourly_rate': 45.0,
        'date_of_birth': '1992-05-15',
        'is_online': true,
        'live_availability': 'online',
        'registration_status': 'approved',
        'approved_services': [
          {'id': 1, 'name': 'AC Maintenance'},
          {'id': 2, 'name': 'Compressor Replacement'},
        ],
        'documents_status': {
          'identity_proof': {
            'category': 'identity_proof',
            'title': 'National Identity Card',
            'document_number': 'ID-998877',
            'file_url': 'https://example.com/id.jpg',
            'status': 'approved',
            'expiry_date': '2030-12-31',
          },
          'driver_license': {
            'category': 'driver_license',
            'title': 'Driving License',
            'document_number': 'DL-112233',
            'file_url': 'https://example.com/dl.pdf',
            'status': 'rejected',
            'rejection_reason': 'Document image blurred. Please re-upload.',
          },
        },
        'controlled_fields': {
          'is_locked': true,
          'locked_fields': [
            'first_name',
            'last_name',
            'date_of_birth',
            'mobile_number',
            'department',
            'state',
          ],
        },
      };

      final profile = EmployeeProfile.fromJson(json);

      expect(profile.employeeId, 'ORG--0024');
      expect(profile.firstName, 'Mani');
      expect(profile.lastName, 'S');
      expect(profile.fullName, 'Mani S');
      expect(profile.email, 'mani@gmail.com');
      expect(profile.mobileNumber, '1234597890');
      expect(profile.displayPhone, '1234597890');
      expect(profile.bio, 'Certified Air Conditioning & Refrigeration Specialist');
      expect(profile.timezone, 'Asia/Kolkata');
      expect(profile.language, 'en');
      expect(profile.avatar, 'https://example.com/avatar.jpg');
      expect(profile.title, 'Senior AC Technician');
      expect(profile.companyName, 'CalServices Vendor Corp');
      expect(profile.department, 'Field Operations');
      expect(profile.state, 'California');
      expect(profile.country, 'United States');
      expect(profile.hourlyRate, 45.0);
      expect(profile.dateOfBirth, '1992-05-15');
      expect(profile.isOnline, isTrue);
      expect(profile.registrationStatus, 'approved');

      expect(profile.approvedServices.length, 2);
      expect(profile.approvedServices[0].name, 'AC Maintenance');

      expect(profile.documents.length, 2);
      final idDoc = profile.documents.firstWhere((d) => d.category == 'identity_proof');
      expect(idDoc.title, 'National Identity Card');
      expect(idDoc.documentNumber, 'ID-998877');
      expect(idDoc.isApproved, isTrue);
      expect(idDoc.hasFile, isTrue);

      final dlDoc = profile.documents.firstWhere((d) => d.category == 'driver_license');
      expect(dlDoc.isRejected, isTrue);
      expect(dlDoc.rejectionReason, contains('blurred'));

      expect(profile.controlledFields.isLocked, isTrue);
      expect(profile.controlledFields.lockedFields, contains('first_name'));
    });

    test('parses EmployeeChangeRequest JSON correctly', () {
      final json = {
        'id': 101,
        'field_name': 'first_name',
        'field_label': 'Legal First Name',
        'old_value': 'Manikandan',
        'new_value': 'Mani',
        'reason': 'Preferred official nickname correction',
        'status': 'PENDING',
        'admin_notes': null,
        'created_at': '2026-08-21T10:00:00Z',
      };

      final cr = EmployeeChangeRequest.fromJson(json);

      expect(cr.id, 101);
      expect(cr.fieldName, 'first_name');
      expect(cr.fieldLabel, 'Legal First Name');
      expect(cr.oldValue, 'Manikandan');
      expect(cr.newValue, 'Mani');
      expect(cr.reason, 'Preferred official nickname correction');
      expect(cr.status, 'PENDING');
      expect(cr.createdAt, isNotNull);
    });
  });
}
