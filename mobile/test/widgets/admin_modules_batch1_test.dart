import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/admin/domain/admin_application.dart';
import 'package:mobile/features/admin/domain/admin_change_request.dart';
import 'package:mobile/features/admin/domain/skill.dart';
import 'package:mobile/features/admin/presentation/admin_dashboard_providers.dart';
import 'package:mobile/features/admin/presentation/applications/admin_applications_screen.dart';
import 'package:mobile/features/admin/presentation/employees/admin_employees_screen.dart';
import 'package:mobile/features/admin/presentation/skills/admin_skills_screen.dart';
import 'package:mobile/features/admin/presentation/widgets/admin_drawer.dart';

final mockTechs = [
  const AdminApplication(
    id: 1,
    employeeId: 'EMP-001',
    name: 'Suresh Kumar',
    phone: '+919876543210',
    registrationStatus: 'approved',
    isOnline: true,
    allRequestedServices: [
      AdminServiceItem(id: 101, name: 'HVAC AC Repair', status: 'approved'),
      AdminServiceItem(id: 102, name: 'Electrical Wiring', status: 'approved'),
    ],
  ),
  const AdminApplication(
    id: 2,
    employeeId: 'EMP-002',
    name: 'Ramesh Patel',
    phone: '+919123456789',
    registrationStatus: 'submitted',
    isOnline: false,
    allRequestedServices: [
      AdminServiceItem(id: 103, name: 'Plumbing Service', status: 'pending'),
    ],
  ),
];

final mockChangeRequests = [
  const AdminChangeRequest(
    id: 50,
    employeeId: 'EMP-001',
    employeeName: 'Suresh Kumar',
    fieldName: 'first_name',
    fieldLabel: 'Legal First Name',
    oldValue: 'Suresh',
    newValue: 'Suresh Raj',
    status: 'pending',
  ),
];

final mockSkills = [
  const Skill(
    id: 1,
    name: 'AC Gas Refill & Overhaul',
    category: 'HVAC',
    description: 'Refrigerant pressure checks and leak detection.',
  ),
  const Skill(
    id: 2,
    name: 'Switchboard & Distribution Box',
    category: 'Electrical',
    description: '3-phase and single-phase distribution boxes.',
  ),
];

void main() {
  setUp(() {
    AppColors.configure(brightness: Brightness.light, highContrast: false);
  });

  Widget buildTestableWidget(Widget child, {List<Override> overrides = const []}) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: child,
      ),
    );
  }

  group('Admin Batch 1 Modules Tests', () {
    testWidgets('AdminDrawer renders all navigation groups and links', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());
      final router = GoRouter(
        initialLocation: '/admin/home',
        routes: [
          GoRoute(
            path: '/admin/home',
            builder: (context, state) => const Scaffold(
              drawer: AdminDrawer(),
              body: Text('Test Content'),
            ),
          ),
          GoRoute(path: '/admin/employees', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/applications', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/services', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/skills', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/jobs', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/dispatch', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/live-workforce', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/reports', builder: (c, s) => const Scaffold()),
          GoRoute(path: '/admin/settings', builder: (c, s) => const Scaffold()),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open Drawer
      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('WORKFORCE ADMIN'), findsOneWidget);
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Employees'), findsOneWidget);
      expect(find.text('Applications'), findsOneWidget);
      expect(find.text('Services'), findsOneWidget);
      expect(find.text('Skills'), findsOneWidget);
      expect(find.text('Jobs'), findsOneWidget);
      expect(find.text('Dispatch'), findsOneWidget);
      expect(find.text('Live Workforce'), findsOneWidget);
      expect(find.text('Reports'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('Log Out'), findsOneWidget);
    });

    testWidgets('AdminEmployeesScreen renders technician cards and presence badges', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          const AdminEmployeesScreen(),
          overrides: [
            adminApplicationsListProvider(null).overrideWith((ref) => Future.value(mockTechs)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Workforce Employee Roster'), findsOneWidget);
      expect(find.text('Suresh Kumar'), findsOneWidget);
      expect(find.text('Ramesh Patel'), findsOneWidget);
      expect(find.text('Online (Ready)'), findsOneWidget);
      expect(find.text('Offline'), findsOneWidget);
      expect(find.text('View Details'), findsNWidgets(2));
    });

    testWidgets('AdminApplicationsScreen renders tabs and change requests', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          const AdminApplicationsScreen(),
          overrides: [
            adminApplicationsListProvider(null).overrideWith((ref) => Future.value(mockTechs)),
            adminChangeRequestsProvider.overrideWith((ref) => Future.value(mockChangeRequests)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Employee Applications & Verification Queue'), findsOneWidget);
      expect(find.text('Applications'), findsOneWidget);
      expect(find.text('Change Requests'), findsOneWidget);
      expect(find.text('Review Dossiers'), findsNWidgets(2));

      // Switch to Change Requests Tab
      await tester.tap(find.text('Change Requests'));
      await tester.pumpAndSettle();

      expect(find.text('Legal First Name'), findsOneWidget);
      expect(find.text('Review / Decide'), findsOneWidget);
    });

    testWidgets('AdminSkillsScreen renders catalog, categories, and action buttons', (tester) async {
      await tester.pumpWidget(
        buildTestableWidget(
          const AdminSkillsScreen(),
          overrides: [
            adminSkillsProvider.overrideWith((ref) => Future.value(mockSkills)),
            adminApplicationsListProvider(null).overrideWith((ref) => Future.value(mockTechs)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Workforce Skills & Verification Matrix'), findsOneWidget);
      expect(find.text('New Skill'), findsOneWidget);
      expect(find.text('Assign Skill'), findsOneWidget);
      expect(find.text('AC Gas Refill & Overhaul'), findsOneWidget);
      expect(find.text('Switchboard & Distribution Box'), findsOneWidget);
      expect(find.text('HVAC'), findsNWidgets(2)); // category chip + card tag
    });
  });
}
