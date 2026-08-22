import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/domain/employee_profile.dart';
import 'package:mobile/features/profile/presentation/profile_providers.dart';
import 'package:mobile/features/services/domain/service_catalog.dart';
import 'package:mobile/features/services/presentation/services_providers.dart';
import 'package:mobile/features/services/presentation/services_screen.dart';

void main() {
  group('ServicesScreen Widget Tests', () {
    final testProfile = EmployeeProfile(
      employeeId: 'ORG--0024',
      firstName: 'Mani',
      lastName: 'S',
      email: 'mani@gmail.com',
      isOnline: true,
      liveAvailability: 'busy',
      registrationStatus: 'approved',
      approvedServices: const [
        ApprovedService(id: 1, name: 'AC Regular Servicing & Jet Clean'),
      ],
      allRequestedServices: const [
        RequestedService(
          id: 1,
          name: 'AC Regular Servicing & Jet Clean',
          status: 'approved',
          requestType: 'add',
        ),
        RequestedService(
          id: 2,
          name: 'AC Gas Charging',
          status: 'pending',
          requestType: 'add',
        ),
        RequestedService(
          id: 3,
          name: 'Heavy Duct Installation',
          status: 'rejected',
          requestType: 'add',
          rejectionReason: 'Requires commercial HVAC license level 2.',
        ),
      ],
      documents: const [],
      controlledFields: const ControlledFieldsConfig(isLocked: true, lockedFields: []),
    );

    final testCatalog = [
      const CatalogCategory(
        id: 1,
        name: 'AC & Appliance',
        slug: 'ac-appliance',
        services: [
          CatalogService(
            id: 1,
            name: 'AC Regular Servicing & Jet Clean',
            slug: 'ac-regular-servicing',
            durationMinutes: 60,
          ),
          CatalogService(
            id: 2,
            name: 'AC Gas Charging',
            slug: 'ac-gas-charging',
            durationMinutes: 90,
          ),
          CatalogService(
            id: 4,
            name: 'PCB Circuit Repair',
            slug: 'pcb-repair',
            durationMinutes: 45,
          ),
        ],
      ),
    ];

    final testSkills = [
      const EmployeeSkill(
        id: 1,
        skillId: 10,
        skillName: 'Compressor Diagnosis',
        category: 'Cooling Systems',
        proficiencyLevel: 'EXPERT',
        isVerified: true,
      ),
    ];

    testWidgets('renders worker summary, authorized, pending, rejected, catalog, and skills', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            employeeProfileProvider.overrideWith((ref) => Future.value(testProfile)),
            serviceCatalogProvider.overrideWith((ref) => Future.value(testCatalog)),
            employeeSkillsProvider.overrideWith((ref) => Future.value(testSkills)),
          ],
          child: const MaterialApp(
            home: ServicesScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Worker Summary
      expect(find.text('Services & Skills'), findsOneWidget);
      expect(find.text('Mani S'), findsOneWidget);
      expect(find.text('ID: ORG--0024 • CalServices'), findsOneWidget);
      expect(find.text('BUSY (ON JOB)'), findsOneWidget);

      // Verify Authorized Services
      expect(find.text('AUTHORIZED SERVICES (1)'), findsOneWidget);
      expect(find.text('AC Regular Servicing & Jet Clean'), findsWidgets);
      expect(find.text('Authorized ✓'), findsOneWidget);
      expect(find.text('Request Removal'), findsOneWidget);

      // Verify Pending Review
      expect(find.text('PENDING ADMIN REVIEW (1)'), findsOneWidget);
      expect(find.text('AC Gas Charging'), findsWidgets);
      expect(find.text('AUTHORIZATION PENDING REVIEW'), findsOneWidget);

      // Verify Rejected Requests
      expect(find.text('REJECTED SERVICE REQUESTS (1)'), findsOneWidget);
      expect(find.text('Heavy Duct Installation'), findsOneWidget);
      expect(find.text('Reason: Requires commercial HVAC license level 2.'), findsOneWidget);
      expect(find.text('Re-apply for Authorization'), findsOneWidget);

      // Scroll down for Catalog and Skills
      await tester.drag(find.byType(ListView).first, const Offset(0, -800));
      await tester.pumpAndSettle();

      // Verify Available Catalog
      expect(find.text('Available Service Catalog'), findsOneWidget);
      expect(find.text('AC & Appliance'), findsOneWidget);
      expect(find.text('PCB Circuit Repair'), findsOneWidget);
      expect(find.text('Request'), findsOneWidget);

      // Verify Verified Skills
      expect(find.text('VERIFIED SKILL RATINGS (1)'), findsOneWidget);
      expect(find.text('Compressor Diagnosis'), findsOneWidget);
      expect(find.text('EXPERT'), findsOneWidget);
    });

    testWidgets('shows removal confirmation dialog when Request Removal tapped', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            employeeProfileProvider.overrideWith((ref) => Future.value(testProfile)),
            serviceCatalogProvider.overrideWith((ref) => Future.value(testCatalog)),
            employeeSkillsProvider.overrideWith((ref) => Future.value(testSkills)),
          ],
          child: const MaterialApp(
            home: ServicesScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Request Removal'));
      await tester.pumpAndSettle();

      expect(find.text('Request Removal of "AC Regular Servicing & Jet Clean"?'), findsOneWidget);
      expect(
        find.text(
          'This will submit a service removal request to Admin for review. You will remain authorized until the request is reviewed.',
        ),
        findsOneWidget,
      );
      expect(find.text('Cancel'), findsOneWidget);
    });
  });
}
