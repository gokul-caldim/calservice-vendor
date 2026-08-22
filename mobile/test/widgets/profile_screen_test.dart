import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/domain/employee_profile.dart';
import 'package:mobile/features/profile/presentation/profile_providers.dart';
import 'package:mobile/features/profile/presentation/profile_screen.dart';

void main() {
  group('ProfileScreen Widget Tests', () {
    final testProfile = EmployeeProfile(
      employeeId: 'ORG--0024',
      firstName: 'Mani',
      lastName: 'S',
      email: 'mani@gmail.com',
      mobileNumber: '1234597890',
      phone: '1234597890',
      bio: 'Certified Air Conditioning Specialist',
      timezone: 'Asia/Kolkata',
      language: 'en',
      avatar: null,
      title: 'Senior Technician',
      companyName: 'CalServices',
      department: 'Field Services',
      state: 'California',
      country: 'United States',
      dateOfBirth: '1992-05-15',
      isOnline: true,
      liveAvailability: 'online',
      registrationStatus: 'approved',
      approvedServices: const [],
      allRequestedServices: const [],
      documents: const [],
      controlledFields: const ControlledFieldsConfig(
        isLocked: true,
        lockedFields: ['first_name', 'last_name', 'date_of_birth', 'mobile_number', 'department', 'state'],
      ),
    );

    final testChangeRequests = [
      EmployeeChangeRequest(
        id: 101,
        fieldName: 'first_name',
        fieldLabel: 'Legal First Name',
        oldValue: 'Manikandan',
        newValue: 'Mani',
        reason: 'Preferred name correction',
        status: 'PENDING',
        adminNotes: null,
        createdAt: DateTime.parse('2026-08-21T10:00:00Z'),
      ),
    ];

    testWidgets('renders all 4 profile sections with authentic data', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            employeeProfileProvider.overrideWith((ref) => Future.value(testProfile)),
            changeRequestsProvider.overrideWith((ref) => Future.value(testChangeRequests)),
          ],
          child: const MaterialApp(
            home: ProfileScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Header
      expect(find.text('My Profile'), findsOneWidget);
      expect(find.text('Mani S'), findsOneWidget);
      expect(find.text('Senior Technician • CalServices'), findsOneWidget);
      expect(find.text('ID: ORG--0024'), findsOneWidget);
      expect(find.text('mani@gmail.com'), findsOneWidget);

      // Verify Personal Preferences
      expect(find.text('PERSONAL PREFERENCES'), findsOneWidget);
      expect(find.text('Directly Editable'), findsOneWidget);
      expect(find.text('Contact Phone'), findsOneWidget);
      expect(find.text('Professional Bio / Notes'), findsOneWidget);
      expect(find.text('Save Preferences'), findsOneWidget);

      // Verify Protected Information & Policy
      expect(find.text('VERIFIED IDENTITY & EMPLOYMENT'), findsOneWidget);
      expect(find.text('Verified Data Governance Policy'), findsOneWidget);
      expect(find.text('LEGAL FIRST NAME'), findsOneWidget);
      expect(find.text('LEGAL LAST NAME'), findsOneWidget);
      expect(find.text('DATE OF BIRTH'), findsOneWidget);
      expect(find.text('REGISTERED MOBILE'), findsOneWidget);
      expect(find.text('DEPARTMENT'), findsOneWidget);
      expect(find.text('STATE / TERRITORY'), findsOneWidget);
      expect(find.text('Request Edit'), findsNWidgets(6));

      // Scroll down to reveal Change Requests section
      await tester.drag(find.byType(ListView).first, const Offset(0, -800));
      await tester.pumpAndSettle();

      // Verify Change Requests History
      expect(find.text('EMPLOYEE CHANGE REQUESTS'), findsOneWidget);
      expect(find.text('#101'), findsOneWidget);
      expect(find.text('Old: Manikandan'), findsOneWidget);
      expect(find.text('New: Mani'), findsOneWidget);
      expect(find.text('Reason: "Preferred name correction"'), findsOneWidget);
    });

    testWidgets('shows change request sheet when Request Edit tapped', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            employeeProfileProvider.overrideWith((ref) => Future.value(testProfile)),
            changeRequestsProvider.overrideWith((ref) => Future.value(const [])),
          ],
          child: const MaterialApp(
            home: ProfileScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Request Edit').first);
      await tester.pumpAndSettle();

      expect(find.text('Submit Profile Change Request'), findsOneWidget);
      expect(find.text('Target Controlled Field'), findsOneWidget);
      expect(find.text('New Requested Value'), findsOneWidget);
      expect(find.text('Reason for Change & Supporting Reference'), findsOneWidget);
      expect(find.text('Submit for Admin Review'), findsOneWidget);
    });
  });
}
