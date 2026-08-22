import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/domain/employee_profile.dart';
import 'package:mobile/features/profile/presentation/profile_providers.dart';
import 'package:mobile/features/documents/presentation/documents_screen.dart';

void main() {
  group('DocumentsScreen Widget Tests', () {
    final populatedProfile = EmployeeProfile(
      employeeId: 'ORG--0024',
      firstName: 'Mani',
      lastName: 'S',
      email: 'mani@gmail.com',
      isOnline: true,
      registrationStatus: 'approved',
      approvedServices: const [],
      allRequestedServices: const [],
      documents: [
        const EmployeeDocument(
          category: 'identity_proof',
          title: 'Government Identity Proof',
          documentNumber: 'ID-12345',
          fileUrl: 'https://example.com/id.jpg',
          status: 'approved',
        ),
        const EmployeeDocument(
          category: 'driver_license',
          title: 'Driver License',
          documentNumber: 'DL-67890',
          fileUrl: 'https://example.com/dl.jpg',
          status: 'rejected',
          rejectionReason: 'Image is expired or unreadable.',
        ),
      ],
      controlledFields: const ControlledFieldsConfig(isLocked: true, lockedFields: []),
    );

    final emptyProfile = EmployeeProfile(
      employeeId: 'ORG--0024',
      firstName: 'Mani',
      lastName: 'S',
      isOnline: false,
      registrationStatus: 'not_started',
      approvedServices: const [],
      allRequestedServices: const [],
      documents: const [],
      controlledFields: const ControlledFieldsConfig(isLocked: false, lockedFields: []),
    );

    testWidgets('renders document summary strip and cards when documents exist', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            employeeProfileProvider.overrideWith((ref) => Future.value(populatedProfile)),
          ],
          child: const MaterialApp(
            home: DocumentsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Header and Overview
      expect(find.text('Documents'), findsOneWidget);
      expect(find.text('TOTAL DOSSIER'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('VERIFIED'), findsOneWidget);
      expect(find.text('ACTION NEEDED'), findsOneWidget);

      // Verify Section Header
      expect(find.text('VERIFIED IDENTIFICATION & DOSSIER'), findsOneWidget);
      expect(find.text('ID: ORG--0024'), findsOneWidget);

      // Verify Documents
      expect(find.text('Government Identity Proof'), findsOneWidget);
      expect(find.text('IDENTITY_PROOF'), findsOneWidget);
      expect(find.text('ID-12345'), findsOneWidget);
      expect(find.text('Preview / View'), findsNWidgets(2));
      expect(find.text('Replace'), findsNWidgets(2));

      expect(find.text('Driver License'), findsOneWidget);
      expect(find.text('DRIVER_LICENSE'), findsOneWidget);
      expect(find.text('Rejection Reason: Image is expired or unreadable.'), findsOneWidget);
    });

    testWidgets('renders empty state when no documents exist', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            employeeProfileProvider.overrideWith((ref) => Future.value(emptyProfile)),
          ],
          child: const MaterialApp(
            home: DocumentsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No onboarding dossier documents on file.'), findsOneWidget);
      expect(
        find.text('Uploaded identity proofs and compliance certificates will appear here.'),
        findsOneWidget,
      );
    });
  });
}
